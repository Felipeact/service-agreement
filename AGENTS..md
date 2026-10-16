# Service Agreement micro-saas.

Most use the skill `/impeccable` for anything related to  UI and UX.
Use English for all the content of the web site 


# Design Principles 

Use SOLID for the application, see below 

- S — Single-Responsibility Principle (SRP): A class should have only one reason to change, meaning it should only have one job or responsibility.
- O — Open-Closed Principle (OCP): Software entities (classes, modules, functions) should be open for extension, but closed for modification. You should add new behavior without altering existing code.
- L — Liskov Substitution Principle (LSP): Objects of a superclass should be replaceable with objects of its subclasses without breaking the application. Child classes must honor the contracts of their parent classes.
- I — Interface Segregation Principle (ISP): Clients should not be forced to depend on interfaces they do not use. Split large, general-purpose interfaces into smaller, specific ones.
- D — Dependency Inversion Principle (DIP): High-level modules should not depend on low-level modules. Both should depend on abstractions (such as interfaces) rather than concrete implementations.

# Test that stay in the repo

Layer| what it proves | How    |
-----|----------------|--------|
n8n | an automation, AI workflow, or system works| having verifiable, audit-ready evidence that a workflow ran correctly, made the right decisions, and produced accurate results
Stripe | Idempotency  | applying it multiple times produces the same final result as applying it just once |
Web  | nothin in git  | see below |

# Web validation — Playwright screen & touch (mandatory)

ALWAYS finish every implementation that touches the web app (`web/`) by validating it in a real browser with the Playwright MCP tools. An implementation is NOT done until this passes. These checks are run live and are not committed to git.

1. Start the app (`npm run dev` in `web/`) and open the changed pages with `browser_navigate`.
2. Check each changed page on these screen sizes, using `browser_resize`:
   - Mobile: 375x812
   - Tablet: 768x1024
   - Desktop: 1440x900
3. On every screen size:
   - Take a `browser_snapshot` and a `browser_take_screenshot`, then review them.
   - Check there is no horizontal scroll, no overlapping or cut-off content, and no broken layout.
   - Make sure the text is readable and every touch target is at least 44x44px on mobile and tablet.
4. Touch validation (mobile and tablet): use touch emulation (`hasTouch`/`isMobile` through `browser_run_code_unsafe`, or tap with `browser_click`) to exercise every changed interactive element: buttons, links, forms, menus, modals, and dropdowns. Confirm each one responds correctly and that nothing depends on hover alone.
5. Run `browser_console_messages` and confirm there are no errors or warnings, and check `browser_network_requests` for failed requests.
6. Fix every problem you find, then run the validation again until everything passes.
7. In the final report, list the pages and screen sizes you validated, the touch interactions you tested, and the issues you found and fixed.


# Roadmap 

Everytime a roadmap item is completed mark it as done in the ROADMAP.md

