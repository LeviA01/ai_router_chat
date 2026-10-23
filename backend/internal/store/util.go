package store

import (
	"encoding/json"
)

func encodeModels(models []string) string {
	if models == nil {
		models = []string{}
	}
	data, _ := json.Marshal(models)
	return string(data)
}

func decodeModels(s string) []string {
	var out []string
	if s == "" || s == "[]" {
		return out
	}
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return []string{}
	}
	return out
}
