package api

import (
	"net/http"
	"errors"
	"io"

	"github.com/HasselAssel/Fettsack/api/models"
	"github.com/HasselAssel/Fettsack/api/logic"
)

func processRequestInfo[T any](w http.ResponseWriter, r *http.Request) (models.RequestInfo[T], error) {
	var result models.RequestInfo[T]

	user, err := logic.UserFromHeader(r.Header)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return result, err
	}

	payload, err := logic.DecodeJSON[T](r.Body)
	if err != nil && !errors.Is(err, io.EOF) {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return result, err
	}

	result.User = user
	result.Payload = payload

	return result, nil
}