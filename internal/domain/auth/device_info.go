package auth

import "github.com/mileusna/useragent"

func GetDeviceInfo(userAgentString string) map[string]any {
	if userAgentString == "" {
		return map[string]any{
			"browser": "Unknown Browser", "browser_version": "",
			"os": "Unknown OS", "os_version": "",
			"device_type": "Unknown", "device": "Unknown Device",
			"mobile": false, "tablet": false, "desktop": false, "bot": false,
		}
	}
	ua := useragent.Parse(userAgentString)

	deviceType := "Desktop"
	switch {
	case ua.Mobile:
		deviceType = "Mobile"
	case ua.Tablet:
		deviceType = "Tablet"
	case ua.Bot:
		deviceType = "Bot"
	}

	browser := "Unknown Browser"
	if ua.Name != "" {
		browser = ua.Name
		if ua.Version != "" {
			browser = ua.Name + " " + ua.Version
		}
	}

	os := "Unknown OS"
	if ua.OS != "" {
		os = ua.OS
		if ua.OSVersion != "" {
			os = ua.OS + " " + ua.OSVersion
		}
	}

	device := "Unknown Device"
	switch {
	case ua.Device != "":
		device = ua.Device
	case ua.Mobile:
		device = "Mobile Device"
	case ua.Tablet:
		device = "Tablet"
	default:
		device = "Desktop Computer"
	}

	return map[string]any{
		"browser": browser, "browser_version": ua.Version,
		"os": os, "os_version": ua.OSVersion,
		"device_type": deviceType, "device": device,
		"mobile": ua.Mobile, "tablet": ua.Tablet,
		"desktop": !ua.Mobile && !ua.Tablet && !ua.Bot, "bot": ua.Bot,
	}
}

func GetLocationInfo(ipAddress string) string {
	if ipAddress == "" || ipAddress == "127.0.0.1" || ipAddress == "::1" {
		return "Local"
	}
	return "Unknown Location"
}
