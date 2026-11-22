#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env, Vec,
};

pub const MAX_PLAZO: u64 = 1_827 * 86_400;
pub const GRACIA: u64 = 30 * 86_400;
pub const MAX_VERIFICADORES: u32 = 10;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    FolioNoAtestado = 1,
    FolioOcupado = 2,
    FolioLibre = 3,
    PlazoInvalido = 4,
    TodaviaVigente = 5,
    InquilinoEsDueno = 6,
    FirmasInsuficientes = 7,
    NoEsVerificador = 8,
    FirmanteRepetido = 9,
    ParametrosInvalidos = 10,
    DuenoDistinto = 11,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Estado {
    Libre,
    Bloqueado,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Motivo {
    Finalizado,
    Cancelado,
    SinFondeo,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Folio {
    pub dueno: Address,
    pub estado: Estado,
    pub atestado_en: u64,
    pub inquilino: Option<Address>,
    pub escrow: Option<Address>,
    pub vence: u64,
}

#[contractevent]
pub struct FolioAtestado {
    #[topic]
    pub folio: BytesN<32>,
    pub dueno: Address,
}

#[contractevent]
pub struct FolioBloqueado {
    #[topic]
    pub folio: BytesN<32>,
    pub inquilino: Address,
    pub escrow: Address,
    pub vence: u64,
}

#[contractevent]
pub struct FolioLiberado {
    #[topic]
    pub folio: BytesN<32>,
    pub motivo: Motivo,
    pub por_vencimiento: bool,
}

#[contractevent]
pub struct VerificadorAgregado {
    #[topic]
    pub verificador: Address,
}

#[contractevent]
pub struct VerificadorQuitado {
    #[topic]
    pub verificador: Address,
}

#[contractevent]
pub struct UmbralCambiado {
    pub umbral: u32,
}

#[contract]
pub struct UtamaFolios;

const TTL_MIN: u32 = 17_280 * 30;

#[contracttype]
pub enum Clave {
    Verificadores,
    Umbral,
    Folio(BytesN<32>),
}

fn verificadores_de(env: &Env) -> Vec<Address> {
    env.storage().instance().get(&Clave::Verificadores).unwrap()
}

fn umbral_de(env: &Env) -> u32 {
    env.storage().instance().get(&Clave::Umbral).unwrap()
}

fn extender_instancia(env: &Env) {
    env.storage().instance().extend_ttl(TTL_MIN, env.storage().max_ttl());
}

fn guardar_set(env: &Env, verificadores: &Vec<Address>, umbral: u32) {
    env.storage().instance().set(&Clave::Verificadores, verificadores);
    env.storage().instance().set(&Clave::Umbral, &umbral);
    extender_instancia(env);
}

/// Valida el quorum: cada firmante es verificador, sin repetidos, con auth,
/// y firmantes.len() >= umbral.
fn exigir_quorum(env: &Env, firmantes: &Vec<Address>) -> Result<(), Error> {
    let vs = verificadores_de(env);
    let n = firmantes.len();
    for i in 0..n {
        let a = firmantes.get(i).unwrap();
        if !vs.contains(&a) {
            return Err(Error::NoEsVerificador);
        }
        for j in 0..i {
            if firmantes.get(j).unwrap() == a {
                return Err(Error::FirmanteRepetido);
            }
        }
    }
    if n < umbral_de(env) {
        return Err(Error::FirmasInsuficientes);
    }
    for a in firmantes.iter() {
        a.require_auth();
    }
    Ok(())
}

fn validar_set(verificadores: &Vec<Address>, umbral: u32) -> Result<(), Error> {
    let n = verificadores.len();
    if n == 0 || n > MAX_VERIFICADORES || umbral < 1 || umbral > n {
        return Err(Error::ParametrosInvalidos);
    }
    for i in 0..n {
        let a = verificadores.get(i).unwrap();
        for j in 0..i {
            if verificadores.get(j).unwrap() == a {
                return Err(Error::ParametrosInvalidos);
            }
        }
    }
    Ok(())
}

fn leer(env: &Env, folio: &BytesN<32>) -> Option<Folio> {
    env.storage().persistent().get(&Clave::Folio(folio.clone()))
}

fn guardar(env: &Env, folio: &BytesN<32>, valor: &Folio) {
    let k = Clave::Folio(folio.clone());
    env.storage().persistent().set(&k, valor);
    env.storage().persistent().extend_ttl(&k, TTL_MIN, env.storage().max_ttl());
    extender_instancia(env);
}

fn soltar(env: &Env, folio: BytesN<32>, motivo: Motivo, por_vencimiento: bool) -> Result<(), Error> {
    let mut f = leer(env, &folio).ok_or(Error::FolioNoAtestado)?;
    if f.estado != Estado::Bloqueado {
        return Err(Error::FolioLibre);
    }
    f.estado = Estado::Libre;
    f.inquilino = None;
    f.escrow = None;
    f.vence = 0;
    guardar(env, &folio, &f);
    FolioLiberado { folio, motivo, por_vencimiento }.publish(env);
    Ok(())
}

#[contractimpl]
impl UtamaFolios {
    pub fn __constructor(
        env: Env,
        verificadores: Vec<Address>,
        umbral: u32,
    ) -> Result<(), Error> {
        validar_set(&verificadores, umbral)?;
        guardar_set(&env, &verificadores, umbral);
        Ok(())
    }

    pub fn atestar_folio(
        env: Env,
        firmantes: Vec<Address>,
        folio: BytesN<32>,
        dueno: Address,
    ) -> Result<(), Error> {
        exigir_quorum(&env, &firmantes)?;
        if let Some(f) = leer(&env, &folio) {
            if f.estado == Estado::Bloqueado {
                return Err(Error::FolioOcupado);
            }
            if f.dueno != dueno {
                return Err(Error::DuenoDistinto);
            }
            // Idempotente: mismo dueno, no se reescribe ni se emite evento.
            guardar(&env, &folio, &f);
            return Ok(());
        }
        let nuevo = Folio {
            dueno: dueno.clone(),
            estado: Estado::Libre,
            atestado_en: env.ledger().timestamp(),
            inquilino: None,
            escrow: None,
            vence: 0,
        };
        guardar(&env, &folio, &nuevo);
        FolioAtestado { folio, dueno }.publish(&env);
        Ok(())
    }

    pub fn bloquear(
        env: Env,
        firmantes: Vec<Address>,
        folio: BytesN<32>,
        inquilino: Address,
        escrow: Address,
        vence: u64,
    ) -> Result<(), Error> {
        exigir_quorum(&env, &firmantes)?;
        let mut f = leer(&env, &folio).ok_or(Error::FolioNoAtestado)?;
        if f.estado != Estado::Libre {
            return Err(Error::FolioOcupado);
        }
        if inquilino == f.dueno {
            return Err(Error::InquilinoEsDueno);
        }
        let now = env.ledger().timestamp();
        let max = now.checked_add(MAX_PLAZO).ok_or(Error::PlazoInvalido)?;
        if vence <= now || vence > max {
            return Err(Error::PlazoInvalido);
        }
        f.estado = Estado::Bloqueado;
        f.inquilino = Some(inquilino.clone());
        f.escrow = Some(escrow.clone());
        f.vence = vence;
        guardar(&env, &folio, &f);
        FolioBloqueado { folio, inquilino, escrow, vence }.publish(&env);
        Ok(())
    }

    pub fn liberar(
        env: Env,
        firmantes: Vec<Address>,
        folio: BytesN<32>,
        motivo: Motivo,
    ) -> Result<(), Error> {
        exigir_quorum(&env, &firmantes)?;
        soltar(&env, folio, motivo, false)
    }

    pub fn liberar_vencido(env: Env, folio: BytesN<32>) -> Result<(), Error> {
        let f = leer(&env, &folio).ok_or(Error::FolioNoAtestado)?;
        if f.estado != Estado::Bloqueado {
            return Err(Error::FolioLibre);
        }
        let limite = f.vence.checked_add(GRACIA).ok_or(Error::PlazoInvalido)?;
        if env.ledger().timestamp() <= limite {
            return Err(Error::TodaviaVigente);
        }
        soltar(&env, folio, Motivo::Finalizado, true)
    }

    pub fn consultar(env: Env, folio: BytesN<32>) -> Option<Folio> {
        leer(&env, &folio)
    }

    pub fn agregar_verificador(
        env: Env,
        firmantes: Vec<Address>,
        nuevo: Address,
    ) -> Result<(), Error> {
        exigir_quorum(&env, &firmantes)?;
        let mut vs = verificadores_de(&env);
        if vs.contains(&nuevo) || vs.len() >= MAX_VERIFICADORES {
            return Err(Error::ParametrosInvalidos);
        }
        vs.push_back(nuevo.clone());
        guardar_set(&env, &vs, umbral_de(&env));
        VerificadorAgregado { verificador: nuevo }.publish(&env);
        Ok(())
    }

    pub fn quitar_verificador(
        env: Env,
        firmantes: Vec<Address>,
        viejo: Address,
    ) -> Result<(), Error> {
        exigir_quorum(&env, &firmantes)?;
        let mut vs = verificadores_de(&env);
        let pos = vs.first_index_of(&viejo).ok_or(Error::ParametrosInvalidos)?;
        if vs.len() - 1 < umbral_de(&env) {
            return Err(Error::ParametrosInvalidos);
        }
        vs.remove(pos);
        guardar_set(&env, &vs, umbral_de(&env));
        VerificadorQuitado { verificador: viejo }.publish(&env);
        Ok(())
    }

    pub fn cambiar_umbral(env: Env, firmantes: Vec<Address>, umbral: u32) -> Result<(), Error> {
        exigir_quorum(&env, &firmantes)?;
        let vs = verificadores_de(&env);
        if umbral < 1 || umbral > vs.len() {
            return Err(Error::ParametrosInvalidos);
        }
        guardar_set(&env, &vs, umbral);
        UmbralCambiado { umbral }.publish(&env);
        Ok(())
    }

    pub fn verificadores(env: Env) -> Vec<Address> {
        verificadores_de(&env)
    }

    pub fn umbral(env: Env) -> u32 {
        umbral_de(&env)
    }
}

#[cfg(test)]
mod test;
