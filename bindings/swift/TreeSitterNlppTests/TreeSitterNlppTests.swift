import XCTest
import SwiftTreeSitter
import TreeSitterNlpp

final class TreeSitterNlppTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_nlpp())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading NL++ grammar")
    }
}
