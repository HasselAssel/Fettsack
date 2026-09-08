package logic

import (
	"encoding/json"
	"io"
)

func DecodeJSON[T any](body io.ReadCloser) (T, error) {
	var payload T

	err := json.NewDecoder(body).Decode(&payload)
	if err != nil {
		return payload, err
	}

	return payload, nil
}
