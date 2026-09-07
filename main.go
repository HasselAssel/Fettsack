package main

import (
	"encoding/json"
	"log"
	"net/http"
	"github.com/HasselAssel/Fettsack/api"
)

func main() {
	db_handle, err := api.GetDbHandle("./dev/test.sqlite")
	if err != nil {
		log.Fatal(err)
	}

	api.Init(db_handle)

	api := api.Api{
		DB_handle: db_handle,
	}
	defer api.CleanUp()

	mux := http.NewServeMux()

	mux.Handle("/", http.FileServer(http.Dir("./web-ui")))

	mux.HandleFunc("POST /api/v1/food/food", api.AddFood)
	mux.HandleFunc("DELETE /api/v1/food/food", api.RemoveFood)
	mux.HandleFunc("POST /api/v1/food/log", api.AddFoodLog)
	mux.HandleFunc("DELETE /api/v1/food/log", api.RemoveFoodLog)
	mux.HandleFunc("POST /api/v1/food/food-and-log", api.AddFoodAndLog)

	mux.HandleFunc("GET /api/v1/food/food", api.GetFoods)
	mux.HandleFunc("GET /api/v1/food/log", api.GetLogs)

	mux.HandleFunc("GET /api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
		})
	})

	log.Println("starting server running at http://localhost:8910 ...")
	log.Fatal(http.ListenAndServe("localhost:8910", mux))
}