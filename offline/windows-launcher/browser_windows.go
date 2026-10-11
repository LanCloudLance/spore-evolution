package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

func openBrowser(url string) error {
	systemRoot := os.Getenv("SystemRoot")
	if systemRoot == "" {
		return fmt.Errorf("SystemRoot is unavailable")
	}
	// Use the system DLL and the registered browser without invoking a command shell.
	shell := syscall.NewLazyDLL(filepath.Join(systemRoot, "System32", "shell32.dll"))
	procedure := shell.NewProc("ShellExecuteW")
	if err := procedure.Find(); err != nil {
		return err
	}
	ole := syscall.NewLazyDLL(filepath.Join(systemRoot, "System32", "ole32.dll"))
	initialize := ole.NewProc("CoInitializeEx")
	uninitialize := ole.NewProc("CoUninitialize")
	if err := initialize.Find(); err != nil {
		return err
	}
	if err := uninitialize.Find(); err != nil {
		return err
	}
	// Browser shell extensions can require a COM apartment on the calling thread.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	initialized, _, _ := initialize.Call(0, 0x2|0x4)
	if uint32(initialized)&0x80000000 != 0 {
		return fmt.Errorf("CoInitializeEx returned %#x", uint32(initialized))
	}
	defer uninitialize.Call()
	open, err := syscall.UTF16PtrFromString("open")
	if err != nil {
		return err
	}
	target, err := syscall.UTF16PtrFromString(url)
	if err != nil {
		return err
	}
	result, _, _ := procedure.Call(
		0, uintptr(unsafe.Pointer(open)), uintptr(unsafe.Pointer(target)), 0, 0, 1,
	)
	if result <= 32 {
		return fmt.Errorf("ShellExecuteW returned %d", result)
	}
	return nil
}
