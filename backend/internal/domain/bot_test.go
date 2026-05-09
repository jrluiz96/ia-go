package domain_test

import (
	"testing"

	"ia-go/backend/internal/domain"
)

func TestValidateContractJSON_Valido(t *testing.T) {
	c := map[string]interface{}{
		"contract_version":  "1.0",
		"execution_context": map[string]interface{}{"timeout_sec": 120},
	}
	missing := domain.ValidateContractJSON(c)
	if len(missing) != 0 {
		t.Errorf("esperado 0 campos ausentes, obteve %v", missing)
	}
}

func TestValidateContractJSON_SemContractVersion(t *testing.T) {
	c := map[string]interface{}{
		"execution_context": map[string]interface{}{"timeout_sec": 120},
	}
	missing := domain.ValidateContractJSON(c)
	if len(missing) != 1 || missing[0] != "contract_version" {
		t.Errorf("esperado [contract_version], obteve %v", missing)
	}
}

func TestValidateContractJSON_SemExecutionContext(t *testing.T) {
	c := map[string]interface{}{
		"contract_version": "1.0",
	}
	missing := domain.ValidateContractJSON(c)
	if len(missing) != 1 || missing[0] != "execution_context" {
		t.Errorf("esperado [execution_context], obteve %v", missing)
	}
}

func TestValidateContractJSON_Vazio(t *testing.T) {
	missing := domain.ValidateContractJSON(map[string]interface{}{})
	if len(missing) != 2 {
		t.Errorf("esperado 2 campos ausentes, obteve %d: %v", len(missing), missing)
	}
}

func TestValidateContractJSON_ValorNil(t *testing.T) {
	c := map[string]interface{}{
		"contract_version":  nil,
		"execution_context": nil,
	}
	missing := domain.ValidateContractJSON(c)
	if len(missing) != 2 {
		t.Errorf("esperado 2 campos nulos rejeitados, obteve %d: %v", len(missing), missing)
	}
}
