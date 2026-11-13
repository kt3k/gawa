// Generated from schema/example.json by schema/generate.ts. Do not edit.
import Foundation

struct Echo: Decodable {
    let text: String
}

struct Add: Decodable {
    let a: Int
    let b: Int
}

struct Ticks: Decodable {
    let count: Int
}

struct Report: Decodable {
    let ok: Bool
    let log: [String]
}
