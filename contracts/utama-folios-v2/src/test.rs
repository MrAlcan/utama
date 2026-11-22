extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    vec, Bytes, Env, Event, IntoVal,
};

struct Ctx<'a> {
    env: Env,
    c: UtamaFoliosClient<'a>,
    id: Address,
    v1: Address,
    v2: Address,
    v3: Address,
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
    let (v1, v2, v3) = (
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    );
    let id = env.register(UtamaFolios, (vec![&env, v1.clone(), v2.clone(), v3.clone()], 2u32));
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
        v1,
        v2,
        v3,
    }
}

impl<'a> Ctx<'a> {
    /// quorum 2/3 valido: v1 + v2
    fn q(&self) -> Vec<Address> {
        vec![&self.env, self.v1.clone(), self.v2.clone()]
    }
}

const DOS_ANIOS: u64 = 63_072_000;

#[test]
fn t01_constructor_guarda_set() {
    let t = setup();
    assert_eq!(t.c.verificadores(), vec![&t.env, t.v1.clone(), t.v2.clone(), t.v3.clone()]);
    assert_eq!(t.c.umbral(), 2);
}

#[test]
fn t02_atestar_quorum_ok_y_evento() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
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
fn t03_una_firma_insuficiente() {
    let t = setup();
    let uno = vec![&t.env, t.v1.clone()];
    assert_eq!(
        t.c.try_atestar_folio(&uno, &t.folio, &t.carlos),
        Err(Ok(Error::FirmasInsuficientes))
    );
    let ninguna: Vec<Address> = vec![&t.env];
    assert_eq!(
        t.c.try_atestar_folio(&ninguna, &t.folio, &t.carlos),
        Err(Ok(Error::FirmasInsuficientes))
    );
    assert_eq!(t.c.consultar(&t.folio), None);
}

#[test]
fn t04_firmante_no_verificador() {
    let t = setup();
    let q = vec![&t.env, t.v1.clone(), t.diego.clone()];
    assert_eq!(
        t.c.try_atestar_folio(&q, &t.folio, &t.carlos),
        Err(Ok(Error::NoEsVerificador))
    );
}

#[test]
fn t05_firmante_repetido() {
    let t = setup();
    let q = vec![&t.env, t.v1.clone(), t.v1.clone()];
    assert_eq!(
        t.c.try_atestar_folio(&q, &t.folio, &t.carlos),
        Err(Ok(Error::FirmanteRepetido))
    );
}

#[test]
fn t06_constructor_invalido() {
    let env = Env::default();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    // register con constructor invalido hace panic (el constructor falla)
    let mk = |vs: Vec<Address>, u: u32| {
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            env.register(UtamaFolios, (vs, u));
        }))
    };
    assert!(mk(vec![&env, a.clone(), b.clone()], 0).is_err());
    assert!(mk(vec![&env, a.clone(), b.clone()], 3).is_err());
    assert!(mk(vec![&env], 1).is_err());
    assert!(mk(vec![&env, a.clone(), a.clone()], 1).is_err());
    let mut once = vec![&env];
    for _ in 0..11 {
        once.push_back(Address::generate(&env));
    }
    assert!(mk(once, 2).is_err());
    let mut diez = vec![&env];
    for _ in 0..10 {
        diez.push_back(Address::generate(&env));
    }
    assert!(mk(diez, 10).is_ok());
    assert!(mk(vec![&env, a.clone()], 1).is_ok());
}

#[test]
fn t07_bloquear_ok() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &vence);
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
fn t08_doble_anticretico_folio_ocupado() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &vence);
    let r = t.c.try_bloquear(&t.q(), &t.folio, &t.diego, &t.escrow, &vence);
    assert_eq!(r, Err(Ok(Error::FolioOcupado)));
    assert_eq!(Error::FolioOcupado as u32, 2);
    assert_eq!(t.c.consultar(&t.folio).unwrap().inquilino, Some(t.maria.clone()));
}

#[test]
fn t09_no_atestado() {
    let t = setup();
    let r = t.c.try_bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &(1_000_000 + DOS_ANIOS));
    assert_eq!(r, Err(Ok(Error::FolioNoAtestado)));
}

#[test]
fn t10_plazo_limite_y_h09() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let now = 1_000_000u64;
    assert_eq!(
        t.c.try_bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &(now + MAX_PLAZO + 1)),
        Err(Ok(Error::PlazoInvalido))
    );
    assert_eq!(
        t.c.try_bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &now),
        Err(Ok(Error::PlazoInvalido))
    );
    assert_eq!(
        t.c.try_bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &u64::MAX),
        Err(Ok(Error::PlazoInvalido))
    );
    t.c.bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &(now + MAX_PLAZO));
    assert_eq!(MAX_PLAZO, 1_827 * 86_400);
}

#[test]
fn t11_inquilino_es_dueno() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let r = t.c.try_bloquear(&t.q(), &t.folio, &t.carlos, &t.escrow, &(1_000_000 + DOS_ANIOS));
    assert_eq!(r, Err(Ok(Error::InquilinoEsDueno)));
}

#[test]
fn t12_liberar_y_rebloquear() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &vence);
    // 1 sola firma no libera
    let uno = vec![&t.env, t.v3.clone()];
    assert_eq!(
        t.c.try_liberar(&uno, &t.folio, &Motivo::Finalizado),
        Err(Ok(Error::FirmasInsuficientes))
    );
    // otro quorum distinto (v2 + v3) si
    let q23 = vec![&t.env, t.v2.clone(), t.v3.clone()];
    t.c.liberar(&q23, &t.folio, &Motivo::Finalizado);
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
    t.c.bloquear(&t.q(), &t.folio, &t.diego, &t.escrow, &vence);
    assert_eq!(t.c.consultar(&t.folio).unwrap().inquilino, Some(t.diego.clone()));
}

#[test]
fn t13_liberar_libre_falla() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    assert_eq!(
        t.c.try_liberar(&t.q(), &t.folio, &Motivo::Cancelado),
        Err(Ok(Error::FolioLibre))
    );
}

#[test]
fn t14_reatestar_bloqueado_falla() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    t.c.bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &(1_000_000 + DOS_ANIOS));
    assert_eq!(
        t.c.try_atestar_folio(&t.q(), &t.folio, &t.diego),
        Err(Ok(Error::FolioOcupado))
    );
    assert_eq!(
        t.c.try_atestar_folio(&t.q(), &t.folio, &t.carlos),
        Err(Ok(Error::FolioOcupado))
    );
}

#[test]
fn t15_liberar_vencido_publico() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let vence = 1_000_000 + DOS_ANIOS;
    t.c.bloquear(&t.q(), &t.folio, &t.maria, &t.escrow, &vence);
    t.env.ledger().set_timestamp(vence + GRACIA);
    assert_eq!(t.c.try_liberar_vencido(&t.folio), Err(Ok(Error::TodaviaVigente)));
    t.env.ledger().set_timestamp(vence + GRACIA + 1);
    t.c.liberar_vencido(&t.folio);
    assert_eq!(t.c.consultar(&t.folio).unwrap().estado, Estado::Libre);
    assert!(t.env.auths().is_empty());
}

#[test]
fn t16_consultar_inexistente() {
    let t = setup();
    assert_eq!(t.c.consultar(&t.folio), None);
}

#[test]
fn t17_h03_dueno_distinto_e_idempotencia() {
    let t = setup();
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    assert_eq!(
        t.c.try_atestar_folio(&t.q(), &t.folio, &t.maria),
        Err(Ok(Error::DuenoDistinto))
    );
    assert_eq!(t.c.consultar(&t.folio).unwrap().dueno, t.carlos);
    // mismo dueno: idempotente, conserva atestado_en
    t.env.ledger().set_timestamp(2_000_000);
    t.c.atestar_folio(&t.q(), &t.folio, &t.carlos);
    let f = t.c.consultar(&t.folio).unwrap();
    assert_eq!(f.dueno, t.carlos);
    assert_eq!(f.atestado_en, 1_000_000);
}

#[test]
fn t18_rotacion_agregar_quitar_umbral() {
    let t = setup();
    let nuevo = Address::generate(&t.env);
    t.c.agregar_verificador(&t.q(), &nuevo);
    assert_eq!(
        t.env.events().all(),
        std::vec![VerificadorAgregado { verificador: nuevo.clone() }.to_xdr(&t.env, &t.id)]
    );
    assert_eq!(t.c.verificadores().len(), 4);
    // duplicado
    assert_eq!(
        t.c.try_agregar_verificador(&t.q(), &nuevo),
        Err(Ok(Error::ParametrosInvalidos))
    );
    // quitar v1 (firman v2+v3): v1 deja de servir
    let q23 = vec![&t.env, t.v2.clone(), t.v3.clone()];
    t.c.quitar_verificador(&q23, &t.v1);
    assert_eq!(
        t.env.events().all(),
        std::vec![VerificadorQuitado { verificador: t.v1.clone() }.to_xdr(&t.env, &t.id)]
    );
    assert_eq!(t.c.verificadores().len(), 3);
    let viejo = vec![&t.env, t.v1.clone(), t.v2.clone()];
    assert_eq!(
        t.c.try_atestar_folio(&viejo, &t.folio, &t.carlos),
        Err(Ok(Error::NoEsVerificador))
    );
    // el nuevo set funciona
    let q_nuevo = vec![&t.env, nuevo.clone(), t.v2.clone()];
    t.c.atestar_folio(&q_nuevo, &t.folio, &t.carlos);
    // quitar inexistente
    assert_eq!(
        t.c.try_quitar_verificador(&q_nuevo, &t.v1),
        Err(Ok(Error::ParametrosInvalidos))
    );
    // cambiar umbral a 3: ahora 2 firmas no bastan
    t.c.cambiar_umbral(&q_nuevo, &3);
    assert_eq!(
        t.env.events().all(),
        std::vec![UmbralCambiado { umbral: 3 }.to_xdr(&t.env, &t.id)]
    );
    assert_eq!(t.c.umbral(), 3);
    assert_eq!(
        t.c.try_atestar_folio(&q_nuevo, &t.folio, &t.carlos),
        Err(Ok(Error::FirmasInsuficientes))
    );
    // umbral fuera de rango
    let q3 = vec![&t.env, nuevo.clone(), t.v2.clone(), t.v3.clone()];
    assert_eq!(t.c.try_cambiar_umbral(&q3, &0), Err(Ok(Error::ParametrosInvalidos)));
    assert_eq!(t.c.try_cambiar_umbral(&q3, &4), Err(Ok(Error::ParametrosInvalidos)));
    // no se puede quitar si quedaria por debajo del umbral (3 verificadores, umbral 3)
    assert_eq!(
        t.c.try_quitar_verificador(&q3, &t.v3),
        Err(Ok(Error::ParametrosInvalidos))
    );
}

#[test]
fn t19_gestion_exige_quorum() {
    let t = setup();
    let uno = vec![&t.env, t.v1.clone()];
    let nuevo = Address::generate(&t.env);
    assert_eq!(
        t.c.try_agregar_verificador(&uno, &nuevo),
        Err(Ok(Error::FirmasInsuficientes))
    );
    assert_eq!(t.c.try_quitar_verificador(&uno, &t.v3), Err(Ok(Error::FirmasInsuficientes)));
    assert_eq!(t.c.try_cambiar_umbral(&uno, &1), Err(Ok(Error::FirmasInsuficientes)));
}

#[test]
fn t20_limite_diez_verificadores() {
    let t = setup();
    for _ in 0..7 {
        t.c.agregar_verificador(&t.q(), &Address::generate(&t.env));
    }
    assert_eq!(t.c.verificadores().len(), 10);
    assert_eq!(
        t.c.try_agregar_verificador(&t.q(), &Address::generate(&t.env)),
        Err(Ok(Error::ParametrosInvalidos))
    );
}

#[test]
fn t21_auths_explicitas_requieren_al_segundo() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000_000);
    let (v1, v2, v3) = (
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    );
    let id = env.register(UtamaFolios, (vec![&env, v1.clone(), v2.clone(), v3.clone()], 2u32));
    let c = UtamaFoliosClient::new(&env, &id);
    let folio = BytesN::from_array(&env, &[9u8; 32]);
    let dueno = Address::generate(&env);
    let firmantes = vec![&env, v1.clone(), v2.clone()];
    let args: Vec<soroban_sdk::Val> = (firmantes.clone(), folio.clone(), dueno.clone()).into_val(&env);
    let inv = MockAuthInvoke {
        contract: &id,
        fn_name: "atestar_folio",
        args,
        sub_invokes: &[],
    };
    let auth = |who| MockAuth { address: who, invoke: &inv };
    // solo firma v1 -> falla la auth de v2
    let r = c.mock_auths(&[auth(&v1)]).try_atestar_folio(&firmantes, &folio, &dueno);
    assert!(r.is_err());
    assert_eq!(c.consultar(&folio), None);
    // firman v1 y v2 -> pasa
    c.mock_auths(&[auth(&v1), auth(&v2)]).atestar_folio(&firmantes, &folio, &dueno);
    assert!(c.consultar(&folio).is_some());
}

#[test]
fn t22_vectores_hash() {
    let env = Env::default();
    let h = |s: &str| env.crypto().sha256(&Bytes::from_slice(&env, s.as_bytes())).to_bytes();
    let a = h("7011990012345");
    let hex = "6fc1fc68c15a3fc6bf6eea29837c17ad935d7c11cd679236a8075a83b752ac6f";
    let mut esperado = [0u8; 32];
    for i in 0..32 {
        esperado[i] = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).unwrap();
    }
    assert_eq!(a.to_array(), esperado);
}
