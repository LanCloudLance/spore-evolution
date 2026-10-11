package main

import "os/exec"

// Used to verify the shared launcher and HTTP server on the build machine.
func openBrowser(url string) error {
	return exec.Command("/usr/bin/open", url).Run()
}
