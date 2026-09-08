package main

import (
	"log"
	"net/http"

	"github.com/HasselAssel/Fettsack/api"
)

func main() {
	db_handle, err := api.GetDbHandleFromEnv()
	if err != nil {
		log.Fatal(err)
	}

	api := api.Api{
		DB_handle: db_handle,
	}
	defer api.CleanUp()

	err = api.Init()
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()

	mux.Handle("/", http.FileServer(http.Dir("./web-ui")))

	mux.HandleFunc("POST /api/v1/food/food", api.AddFood)
	mux.HandleFunc("DELETE /api/v1/food/food", api.RemoveFood)
	mux.HandleFunc("POST /api/v1/food/log", api.AddFoodLog)
	mux.HandleFunc("DELETE /api/v1/food/log", api.RemoveFoodLog)
	mux.HandleFunc("POST /api/v1/food/food-and-log", api.AddFoodAndLog)

	mux.HandleFunc("GET /api/v1/food/food", api.GetFoods)
	mux.HandleFunc("GET /api/v1/food/log", api.GetFoodLogs)

	mux.HandleFunc("POST /api/v1/weight/log", api.AddWeightLog)
	mux.HandleFunc("DELETE /api/v1/weight/log", api.RemoveWeightLog)
	mux.HandleFunc("GET /api/v1/weight/log", api.GetWeightLogs)

	log.Println("starting server running at http://localhost:8910 ...")
	log.Fatal(http.ListenAndServe("localhost:8910", mux))
}
