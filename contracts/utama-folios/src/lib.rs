#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};

pub const MAX_PLAZO: u64 = 1_827 * 86_400;
pub const GRACIA: u64 = 30 * 86_400;

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

#[contract]
pub struct UtamaFolios;

const UMBRAL: u32 = 17_280 * 30;

#[contracttype]
pub enum Clave {
    Admin,
    Folio(BytesN<32>),
}

fn admin_de(env: &Env) -> Address {
    env.storage().instance().get(&Clave::Admin).unwrap()
}

fn extender_instancia(env: &Env) {
    env.storage().instance().extend_ttl(UMBRAL, env.storage().max_ttl());
}

fn leer(env: &Env, folio: &BytesN<32>) -> Option<Folio> {
    env.storage().persistent().get(&Clave::Folio(folio.clone()))
}

fn guardar(env: &Env, folio: &BytesN<32>, valor: &Folio) {
    let k = Clave::Folio(folio.clone());
    env.storage().persistent().set(&k, valor);
    env.storage().persistent().extend_ttl(&k, UMBRAL, env.storage().max_ttl());
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
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&Clave::Admin, &admin);
        extender_instancia(&env);
    }

    pub fn atestar_folio(env: Env, folio: BytesN<32>, dueno: Address) -> Result<(), Error> {
        admin_de(&env).require_auth();
        if let Some(f) = leer(&env, &folio) {
            if f.estado == Estado::Bloqueado {
                return Err(Error::FolioOcupado);
            }
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
        folio: BytesN<32>,
        inquilino: Address,
        escrow: Address,
        vence: u64,
    ) -> Result<(), Error> {
        admin_de(&env).require_auth();
        let mut f = leer(&env, &folio).ok_or(Error::FolioNoAtestado)?;
        if f.estado != Estado::Libre {
            return Err(Error::FolioOcupado);
        }
        if inquilino == f.dueno {
            return Err(Error::InquilinoEsDueno);
        }
        let now = env.ledger().timestamp();
        if vence <= now || vence > now + MAX_PLAZO {
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

    pub fn liberar(env: Env, folio: BytesN<32>, motivo: Motivo) -> Result<(), Error> {
        admin_de(&env).require_auth();
        soltar(&env, folio, motivo, false)
    }

    pub fn liberar_vencido(env: Env, folio: BytesN<32>) -> Result<(), Error> {
        let f = leer(&env, &folio).ok_or(Error::FolioNoAtestado)?;
        if f.estado != Estado::Bloqueado {
            return Err(Error::FolioLibre);
        }
        if env.ledger().timestamp() <= f.vence + GRACIA {
            return Err(Error::TodaviaVigente);
        }
        soltar(&env, folio, Motivo::Finalizado, true)
    }

    pub fn consultar(env: Env, folio: BytesN<32>) -> Option<Folio> {
        leer(&env, &folio)
    }

    pub fn admin(env: Env) -> Address {
        admin_de(&env)
    }
}

#[cfg(test)]
mod test;
