package postgres

import "errors"

// ErrNotFound é retornado por qualquer repo quando o registro não existe.
// Distinto de erros de infraestrutura (DB timeout, connection error, etc.).
// Uso: errors.Is(err, postgres.ErrNotFound)
var ErrNotFound = errors.New("not found")
