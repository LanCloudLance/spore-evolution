import AppKit
import Foundation
import Network
import CryptoKit

// Serve only the packaged game on loopback. No package manager or runtime install.
let arguments = CommandLine.arguments.dropFirst()
guard let filename = arguments.first else {
    fputs("缺少游戏文件。请双击“启动孢子.command”。\n", stderr)
    exit(1)
}
let gameURL = URL(fileURLWithPath: filename)
guard let game = try? Data(contentsOf: gameURL) else {
    fputs("无法读取胞子离线版.html，请完整解压后再启动。\n", stderr)
    exit(1)
}
let digest = SHA256.hash(data: game).map { String(format: "%02x", $0) }.joined()
let health = Data("spore-offline-v1:\(digest)".utf8)
let openBrowser = !arguments.contains("--no-browser")
let address = URL(string: "http://127.0.0.1:49325/")!
let healthAddress = address.appendingPathComponent("__spore_offline_health")

func revealGame() {
    if openBrowser { NSWorkspace.shared.open(address) }
}

// Opening the launcher twice reuses only an identical build on the same origin.
let check = DispatchSemaphore(value: 0)
var alreadyRunning = false
var request = URLRequest(url: healthAddress)
request.timeoutInterval = 1
let session = URLSession(configuration: .ephemeral)
session.dataTask(with: request) { data, _, _ in
    alreadyRunning = data == health
    check.signal()
}.resume()
_ = check.wait(timeout: .now() + 2)
if alreadyRunning {
    print("离线游戏已经启动：\(address.absoluteString)")
    revealGame()
    exit(0)
}

let parameters = NWParameters.tcp
parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 49325)
let listener: NWListener
do { listener = try NWListener(using: parameters) }
catch {
    fputs("启动失败：\(error)。请关闭旧离线启动窗口再试。\n", stderr)
    exit(1)
}
let queue = DispatchQueue(label: "spore.offline.server")

func respond(_ connection: NWConnection, _ status: String, _ type: String, _ body: Data, head: Bool = false) {
    let header = "HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"
    var response = Data(header.utf8)
    if !head { response.append(body) }
    connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
}

func receive(_ connection: NWConnection, _ collected: Data = Data()) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { bytes, _, complete, error in
        var buffer = collected
        if let bytes { buffer.append(bytes) }
        guard buffer.count <= 16384 else {
            respond(connection, "431 Request Header Fields Too Large", "text/plain; charset=utf-8", Data())
            return
        }
        guard let headers = String(data: buffer, encoding: .utf8), headers.contains("\r\n\r\n") else {
            if !complete && error == nil { receive(connection, buffer) }
            else { connection.cancel() }
            return
        }
        let parts = headers.components(separatedBy: "\r\n")[0].split(separator: " ")
        guard parts.count == 3, parts[0] == "GET" || parts[0] == "HEAD" else {
            respond(connection, "405 Method Not Allowed", "text/plain; charset=utf-8", Data())
            return
        }
        let path = String(parts[1]).components(separatedBy: "?")[0]
        let isHead = parts[0] == "HEAD"
        if path == "/__spore_offline_health" {
            respond(connection, "200 OK", "text/plain; charset=utf-8", health, head: isHead)
        } else if path == "/" || path == "/index.html" {
            respond(connection, "200 OK", "text/html; charset=utf-8", game, head: isHead)
        } else {
            respond(connection, "404 Not Found", "text/plain; charset=utf-8", Data("Not found".utf8), head: isHead)
        }
    }
}

listener.newConnectionHandler = { connection in
    connection.start(queue: queue)
    receive(connection)
}
listener.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("孢子离线版已启动：\(address.absoluteString)")
        print("不需要网络。请保留此窗口；结束游戏前点击游戏中的保存。")
        print("关闭此窗口或按 Ctrl+C 可停止启动器。")
        fflush(stdout)
        revealGame()
    case .failed(let error):
        fputs("无法启动：\(error)。49325 端口可能被另一版本占用，请关闭旧启动窗口。\n", stderr)
        exit(1)
    default: break
    }
}
listener.start(queue: queue)
dispatchMain()
