package models

type RequestInfo[T any] struct {
	User User
	Payload T
}