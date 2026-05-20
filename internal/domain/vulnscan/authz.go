package vulnscan

import (
	"net/http"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/echoparams"

	"github.com/labstack/echo/v4"
)

func scanRequirement(svc *Service) func(echo.Context) ([]authz.Requirement, error) {
	return func(c echo.Context) ([]authz.Requirement, error) {
		scanID, err := echoparams.ParseUintParam(c, "scanid")
		if err != nil {
			return nil, err
		}

		serverID, stackName, err := svc.ScanStackRef(scanID)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusNotFound, "scan not found")
		}

		return []authz.Requirement{{
			Kind:       authz.KindStack,
			Permission: permnames.StacksRead,
			ServerID:   serverID,
			Stack:      stackName,
		}}, nil
	}
}

func scanCompareRequirement(svc *Service) func(echo.Context) ([]authz.Requirement, error) {
	return func(c echo.Context) ([]authz.Requirement, error) {
		baseScanID, err := echoparams.ParseUintParam(c, "baseScanId")
		if err != nil {
			return nil, err
		}

		compareScanID, err := echoparams.ParseUintParam(c, "compareScanId")
		if err != nil {
			return nil, err
		}

		baseServerID, baseStackName, err := svc.ScanStackRef(baseScanID)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusNotFound, "scan not found")
		}

		compareServerID, compareStackName, err := svc.ScanStackRef(compareScanID)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusNotFound, "scan not found")
		}

		return []authz.Requirement{
			{
				Kind:       authz.KindStack,
				Permission: permnames.StacksRead,
				ServerID:   baseServerID,
				Stack:      baseStackName,
			},
			{
				Kind:       authz.KindStack,
				Permission: permnames.StacksRead,
				ServerID:   compareServerID,
				Stack:      compareStackName,
			},
		}, nil
	}
}
