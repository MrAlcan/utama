extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    Bytes, Env, Event,
};

struct Ctx<'a> {
    env: Env,
    c: UtamaFoliosClient<'a>,
    id: Address,
    admin: Address,
    carlos: Address,
    maria: Address,
    diego: Address,
    escrow: Address,
    folio: BytesN<32>,
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    let admin = Address::generate(&env);
    let id = env.register(UtamaFolios, (&admin,));
    let c = UtamaFoliosClient::new(&env, &id);
    Ctx {
        carlos: Address::generate(&env),
        maria: Address::generate(&env),
        diego: Address::generate(&env),
        escrow: Address::generate(&env),
        folio: BytesN::from_array(&env, &[7u8; 32]),
        env,
        c,
        id,
        admin,
    }
}

const DOS_ANIOS: u64 = 63_072_000;

#[test]
fn t01_constructor_guarda_admin() {
    let t = setup();
    assert_eq!(t.c.admin(), t.admin);
}

#[test]
fn t02_atestar_ok_y_evento() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    // los eventos son los de la ultima invocacion: se leen antes de consultar
    let evs = t.env.events().all();
    assert_eq!(evs.events().len(), 1);
    assert_eq!(
        evs,
        std::vec![FolioAtestado { folio: t.folio.clone(), dueno: t.carlos.clone() }
            .to_xdr(&t.env, &t.id)]
    );
    let f = t.c.consultar(&t.folio).unwrap();
    assert_eq!(f.estado, Estado::Libre);
    assert_eq!(f.dueno, t.carlos);
    assert_eq!(f.atestado_en, 1_000_000);
}

#[test]
fn t03_atestar_exige_admin() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    assert_eq!(t.env.auths()[0].0, t.admin);
}

#[test]
fn t04_bloquear_ok() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.folio, &t.maria, &t.escrow, &vence);
    assert_eq!(
        t.env.events().all(),
        std::vec![FolioBloqueado {
            folio: t.folio.clone(),
            inquilino: t.maria.clone(),
            escrow: t.escrow.clone(),
            vence
        }
        .to_xdr(&t.env, &t.id)]
    );
    let f = t.c.consultar(&t.folio).unwrap();
    assert_eq!(f.estado, Estado::Bloqueado);
    assert_eq!(f.inquilino, Some(t.maria.clone()));
    assert_eq!(f.escrow, Some(t.escrow.clone()));
    assert_eq!(f.vence, vence);
}

#[test]
fn t05_doble_anticretico_folio_ocupado() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.folio, &t.maria, &t.escrow, &vence);
    let r = t.c.try_bloquear(&t.folio, &t.diego, &t.escrow, &vence);
    assert_eq!(r, Err(Ok(Error::FolioOcupado)));
    assert_eq!(Error::FolioOcupado as u32, 2);
    assert_eq!(t.c.consultar(&t.folio).unwrap().inquilino, Some(t.maria.clone()));
}

#[test]
fn t06_no_atestado() {
    let t = setup();
    let r = t.c.try_bloquear(&t.folio, &t.maria, &t.escrow, &(1_000_000 + DOS_ANIOS));
    assert_eq!(r, Err(Ok(Error::FolioNoAtestado)));
}

#[test]
fn t07_plazo_limite() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    let now = 1_000_000u64;
    assert_eq!(
        t.c.try_bloquear(&t.folio, &t.maria, &t.escrow, &(now + MAX_PLAZO + 1)),
        Err(Ok(Error::PlazoInvalido))
    );
    assert_eq!(
        t.c.try_bloquear(&t.folio, &t.maria, &t.escrow, &now),
        Err(Ok(Error::PlazoInvalido))
    );
    t.c.bloquear(&t.folio, &t.maria, &t.escrow, &(now + MAX_PLAZO));
    assert_eq!(MAX_PLAZO, 1_827 * 86_400);
}

#[test]
fn t08_inquilino_es_dueno() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    let r = t.c.try_bloquear(&t.folio, &t.carlos, &t.escrow, &(1_000_000 + DOS_ANIOS));
    assert_eq!(r, Err(Ok(Error::InquilinoEsDueno)));
}

#[test]
fn t09_liberar_y_rebloquear() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.folio, &t.maria, &t.escrow, &vence);
    t.c.liberar(&t.folio, &Motivo::Finalizado);
    assert_eq!(
        t.env.events().all(),
        std::vec![FolioLiberado {
            folio: t.folio.clone(),
            motivo: Motivo::Finalizado,
            por_vencimiento: false
        }
        .to_xdr(&t.env, &t.id)]
    );
    let f = t.c.consultar(&t.folio).unwrap();
    assert_eq!(f.estado, Estado::Libre);
    assert_eq!((f.inquilino, f.escrow, f.vence), (None, None, 0));
    t.c.bloquear(&t.folio, &t.diego, &t.escrow, &vence);
    assert_eq!(t.c.consultar(&t.folio).unwrap().inquilino, Some(t.diego.clone()));
}

#[test]
fn t10_liberar_libre_falla() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    assert_eq!(t.c.try_liberar(&t.folio, &Motivo::Cancelado), Err(Ok(Error::FolioLibre)));
}

#[test]
fn t11_reatestar_bloqueado_falla() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    t.c.bloquear(&t.folio, &t.maria, &t.escrow, &(1_000_000 + DOS_ANIOS));
    let r = t.c.try_atestar_folio(&t.folio, &t.diego);
    assert_eq!(r, Err(Ok(Error::FolioOcupado)));
}

#[test]
fn t12_liberar_vencido() {
    let t = setup();
    t.c.atestar_folio(&t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.folio, &t.maria, &t.escrow, &vence);
    t.env.ledger().set_timestamp(vence + GRACIA);
    assert_eq!(t.c.try_liberar_vencido(&t.folio), Err(Ok(Error::TodaviaVigente)));
    t.env.ledger().set_timestamp(vence + GRACIA + 1);
    t.c.liberar_vencido(&t.folio);
    assert_eq!(t.c.consultar(&t.folio).unwrap().estado, Estado::Libre);
}

#[test]
fn t13_consultar_inexistente() {
    let t = setup();
    assert_eq!(t.c.consultar(&t.folio), None);
}

#[test]
fn t14_vectores_hash() {
    // Vector compartido con TS: hashFolio("7.01.1.99.0012345") en api/src/common/util.ts.
    // normalizarFolio("7.01.1.99.0012345") == normalizarFolio("70119 90012345") == "7011990012345"
    let env = Env::default();
    let h = |s: &str| env.crypto().sha256(&Bytes::from_slice(&env, s.as_bytes())).to_bytes();
    let a = h("7011990012345");
    let b = h("7011990012345");
    assert_eq!(a, b);
    let hex = "6fc1fc68c15a3fc6bf6eea29837c17ad935d7c11cd679236a8075a83b752ac6f";
    let mut esperado = [0u8; 32];
    for i in 0..32 {
        esperado[i] = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).unwrap();
    }
    assert_eq!(a.to_array(), esperado);
}
