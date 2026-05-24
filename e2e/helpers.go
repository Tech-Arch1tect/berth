package e2e

import "strconv"

func Itoa(n uint) string {
	return strconv.FormatUint(uint64(n), 10)
}
