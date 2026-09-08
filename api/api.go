package api

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/HasselAssel/Fettsack/api/logic"
	"github.com/HasselAssel/Fettsack/api/models"
)

type Api struct {
	DB_handle *sql.DB
}

func (api Api) Init() error {
	var err error
	err = logic.EnsureFoodTables(api.DB_handle)
	if err != nil {
		return fmt.Errorf("API INIT ERROR: EnsureFoodTables %w", err)
	}
	err = logic.EnsureWeightTables(api.DB_handle)
	if err != nil {
		return fmt.Errorf("API INIT ERROR: EnsureWeightTables %w", err)
	}
	return nil
}

func (api Api) CleanUp() {
	api.DB_handle.Close()
}

func (api Api) GetFoods(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[struct{}](w, r)
	if err != nil {
		return
	}

	foods, err := logic.GetFoodsFromDB(api.DB_handle, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusInternalServerError, "failed to get foods")
		return
	}

	httpWriteJSON(w, http.StatusOK, foods)
}

func (api Api) GetFoodLogs(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[struct{}](w, r)
	if err != nil {
		return
	}

	logs, err := logic.GetFoodLogsFromDB(api.DB_handle, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusInternalServerError, "failed to get food logs")
		return
	}

	httpWriteJSON(w, http.StatusOK, logs)
}

func (api Api) GetTrackedFoodContainers(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[struct{}](w, r)
	if err != nil {
		return
	}

	food_containers, err := logic.GetTrackedFoodContainersFromDB(api.DB_handle, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusInternalServerError, "failed to get tracked food containers")
		return
	}

	httpWriteJSON(w, http.StatusOK, food_containers)
}

func (api Api) GetTrackedFoodContainerLogs(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[struct{}](w, r)
	if err != nil {
		return
	}

	logs, err := logic.GetTrackedFoodContainerLogsFromDB(api.DB_handle, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusInternalServerError, "failed to get tracked food container logs")
		return
	}

	httpWriteJSON(w, http.StatusOK, logs)
}

func (api Api) GetWeightLogs(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[struct{}](w, r)
	if err != nil {
		return
	}

	logs, err := logic.GetWeightLogsFromDB(api.DB_handle, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusInternalServerError, "failed to get weight logs")
		return
	}

	httpWriteJSON(w, http.StatusOK, logs)
}

func (api Api) AddFood(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.Food](w, r)
	if err != nil {
		return
	}

	id, err := logic.AddFoodToBD(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to add food")
		return
	}

	httpWriteJSON(w, http.StatusCreated, map[string]int64{
		"id": id,
	})
}

func (api Api) RemoveFood(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodId](w, r)
	if err != nil {
		return
	}

	err = logic.RemoveFoodFromDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to remove food")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (api Api) AddFoodLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodLog](w, r)
	if err != nil {
		return
	}

	id, err := logic.AddFoodLogToDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to add food log")
		return
	}

	httpWriteJSON(w, http.StatusCreated, map[string]int64{
		"id": id,
	})
}

func (api Api) RemoveFoodLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodLogId](w, r)
	if err != nil {
		return
	}

	err = logic.RemoveFoodLogFromDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to remove food log")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (api Api) AddFoodAndLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodAndLog](w, r)
	if err != nil {
		return
	}

	food_id, err := logic.AddFoodToBD(api.DB_handle, *requestInfo.Payload.Food, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to add food")
		return
	}

	requestInfo.Payload.Log.Food_id = &food_id

	log_id, err := logic.AddFoodLogToDB(api.DB_handle, *requestInfo.Payload.Log, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "added food but failed to add log")
		return
	}

	httpWriteJSON(w, http.StatusCreated, map[string]int64{
		"food_id": food_id,
		"log_id":  log_id,
	})
}

func (api Api) AddTrackedFoodContainer(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodTrackedContainer](w, r)
	if err != nil {
		return
	}

	id, err := logic.AddTrackedFoodContainerToDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to add tracked food container")
		return
	}

	httpWriteJSON(w, http.StatusCreated, map[string]int64{
		"id": id,
	})
}

func (api Api) RemoveTrackedFoodContainer(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodTrackedContainerId](w, r)
	if err != nil {
		return
	}

	err = logic.RemoveTrackedFoodContainerFromDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to remove weight log")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (api Api) AddTrackedFoodContainerLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodTrackedContainerLog](w, r)
	if err != nil {
		return
	}

	id, err := logic.AddTrackedFoodContainerLogToDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to add tracked food container")
		return
	}

	httpWriteJSON(w, http.StatusCreated, map[string]int64{
		"id": id,
	})
}

func (api Api) RemoveTrackedFoodContainerLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.FoodTrackedContainerLogId](w, r)
	if err != nil {
		return
	}

	err = logic.RemoveTrackedFoodContainerLogFromDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to remove weight log")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (api Api) AddWeightLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.WeightLog](w, r)
	if err != nil {
		return
	}

	id, err := logic.AddWeightLogToDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to add weight log")
		return
	}

	httpWriteJSON(w, http.StatusCreated, map[string]int64{
		"id": id,
	})
}

func (api Api) RemoveWeightLog(w http.ResponseWriter, r *http.Request) {
	requestInfo, err := processRequestInfo[models.WeightLogId](w, r)
	if err != nil {
		return
	}

	err = logic.RemoveWeightLogFromDB(api.DB_handle, requestInfo.Payload, requestInfo.User)
	if err != nil {
		httpWriteErrorJSON(w, http.StatusUnprocessableEntity, "failed to remove weight log")
		return
	}

	w.WriteHeader(http.StatusOK)
}
