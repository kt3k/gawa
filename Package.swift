// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Gawa",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "Gawa", targets: ["Gawa"]),
    ],
    targets: [
        .target(name: "Gawa", path: "ios/Sources/Gawa"),
        .testTarget(
            name: "GawaTests", dependencies: ["Gawa"], path: "ios/Tests/GawaTests"),
    ]
)
