# Variables comunes (se hace `source`). Sin secretos.
NET=testnet
ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
ASSET="USDC:$ISSUER"
CUENTAS=(utama-verificador utama-tesoro utama-admin-tw utama-mediador utama-carlos utama-lucia utama-maria utama-diego)
RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
PASSPHRASE="Test SDF Network ; September 2015"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
