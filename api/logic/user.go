package logic

import (
	"errors"
	"net/http"
	"strings"
	"github.com/HasselAssel/Fettsack/api/models"
)

func UserFromHeader(header http.Header) (models.User, error) {
	username := strings.TrimSpace(header.Get("Remote-User"))
	if username == "" {
		return models.User{}, errors.New("missing Remote-User header")
	}

	email := strings.TrimSpace(header.Get("Remote-Email"))
	name := strings.TrimSpace(header.Get("Remote-Name"))

	var groups []string
	if raw := strings.TrimSpace(header.Get("Remote-Groups")); raw != "" {
		for _, group := range strings.Split(raw, ",") {
			group = strings.TrimSpace(group)
			if group != "" {
				groups = append(groups, group)
			}
		}
	}

	return models.User{
		User: username,
		Email: email,
		Name: name,
		Groups: groups,
	}, nil
}