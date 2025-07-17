# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Context
This is a **Node.js-based appointment monitoring system** for Raspberry Pi, designed to monitor KFZ-Zulassung (vehicle registration) appointments at lahn-dill-kreis.de.

## Key Technologies
- **Puppeteer**: Headless browser automation for web scraping
- **Express.js**: Web interface for configuration and monitoring
- **Node.js**: Server-side JavaScript runtime
- **ARM64 compatibility**: Optimized for Raspberry Pi

## Code Style Guidelines
- Use **ES6+ features** (async/await, destructuring, arrow functions)
- Implement **robust error handling** with try/catch blocks
- Add **comprehensive logging** for debugging on headless systems
- Use **environment variables** for sensitive configuration
- Write **modular code** with clear separation of concerns

## Architecture Patterns
- **MVC pattern** for web interface
- **Service layer** for business logic
- **Repository pattern** for data access
- **Event-driven architecture** for notifications

## Raspberry Pi Considerations
- **Memory-efficient code** (limited RAM)
- **ARM64 native dependencies** where possible
- **Graceful degradation** for resource constraints
- **Systemd service** compatibility for autostart

## Notification Channels
- E-Mail (SMTP)
- Telegram Bot API
- Discord Webhooks
- Desktop notifications (when GUI available)

## Security Best Practices
- **Input validation** for all user inputs
- **Rate limiting** to prevent abuse
- **Secure credential storage** (environment variables)
- **HTTPS enforcement** for web interface
