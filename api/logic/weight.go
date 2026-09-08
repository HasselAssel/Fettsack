package logic

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/HasselAssel/Fettsack/api/models"
)

func EnsureWeightTables(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		CREATE TABLE IF NOT EXISTS weight_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,

			timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
			grams REAL NOT NULL CHECK (grams > 0)
		);
	`)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func GetWeightLogsFromDB(db *sql.DB, user models.User) ([]struct {
	models.WeightLogId
	models.WeightLog
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			timestamp,
			grams
		FROM weight_log
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []struct {
		models.WeightLogId
		models.WeightLog
	}

	for rows.Next() {
		var logId models.WeightLogId
		var log models.WeightLog

		err := rows.Scan(
			&logId.Weight_id,
			&log.Timestamp,
			&log.Grams,
		)
		if err != nil {
			return nil, err
		}

		logs = append(logs, struct {
			models.WeightLogId
			models.WeightLog
		}{
			WeightLogId: logId,
			WeightLog:   log,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return logs, nil
}

func AddWeightLogToDB(db *sql.DB, payload models.WeightLog, user models.User) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO weight_log (
			user,
			timestamp,
			grams
		)
		VALUES (?, ?, ?)
	`,
		user.User,
		payload.Timestamp,
		payload.Grams,
	)
	if err != nil {
		return -1, err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return -1, err
	}

	if rows == 0 {
		return -1, errors.New("something went wrong: rows == 0")
	}

	return result.LastInsertId()
}

func RemoveWeightLogFromDB(db *sql.DB, payload models.WeightLogId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM weight_log
		WHERE id = ? AND user = ?
	`, payload.Weight_id, user.User)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("weight log not found")
	}

	return nil
}
