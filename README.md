<div align="center">
  <h1>STANDUP</h1>
  <p>Have more organised IRL meetings. Replace your scrum master with AI.</p>
  
  <a href="https://standup.raj.how" target="_blank">
    <img src="https://img.shields.io/badge/Try%20it%20now-standup.raj.how-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWNhc3NldHRlLXRhcGUiPjxwYXRoIGQ9Ik0yIDE1LjVWMTdhMiAyIDAgMCAwIDIgMmgxNmEyIDIgMCAwIDAgMi0ydi0xLjVBMi41IDIuNSAwIDAgMCAyMC41IDEzaC0xN0EyLjUgMi41IDAgMCAwIDIgMTUuNVoiLz48cGF0aCBkPSJNMiA1YTIgMiAwIDAgMSAyLTJoMTZhMiAyIDAgMCAxIDIgMnYxMC41YTIuNSAyLjUgMCAwIDAtMiAyLjQ1di0xLjlhMS41IDEuNSAwIDAgMC0xLjUtMS41aC0xM0ExLjUgMS41IDAgMCAwIDQgMTZ2Mi4wNUEyLjUgMi41IDAgMCAwIDIgMTUuNVY1WiIvPjxjaXJjbGUgY3g9IjgiIGN5PSI5IiByPSIzIi8+PGNpcmNsZSBjeD0iMTYiIGN5PSI5IiByPSIzIi8+PHBhdGggZD0iTTYgMTNoMTIiLz48cGF0aCBkPSJNMiAyaDIwIi8+PC9zdmc+" alt="Try it now">
  </a>
  
  <br />
  <p>Or deploy it yourself</p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxrehpicx%2Fstandup.git&env=BETTER_AUTH_SECRET,BETTER_AUTH_URL,NEXT_PUBLIC_APP_URL,RESEND_API_KEY,DATABASE_URL,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY,S3_ENDPOINT,S3_BUCKET,S3_REGION,GEMINI_API_KEY&envDescription=Environment%20variables%20needed%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Fxrehpicx%2Fstandup%2Fblob%2Fmain%2F.env.sample">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
  
  <br />
  <br />
  
  <a href="#key-features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#running-the-project-locally">Installation</a> •
  <a href="#contribution">Contributing</a> •
  <a href="#license">License</a>
</div>

---

## Key Features

- **Meeting Outcomes**: Extract personalized action items and summaries for individual team members or the entire group
- **Diarization**: Split audio into different speaker streams
- **Voice Recognition**: Identify speakers by their voice patterns
- **Auto Recordings Organization**: Auto-identify speakers in recordings and add them as meeting participants

## How It Works

1. **Create a Workspace**: Set up a shared space for your entire team
2. **Invite Team Members**: Add all team members to your workspace - they'll need to set up their voice IDs
3. **Voice ID Setup**: Each member completes a voice registration process to enable accurate recognition
4. **Create Meetings**: Organize multiple meetings within your workspace
5. **Add Participants**: Select a subset of workspace members as meeting participants to personalize outcomes
6. **Record Meeting Audio**: Use the built-in recorder to capture discussions
7. **Add Recordings to Meetings**: Each meeting can have multiple recordings that get transcribed
8. **Generate Personalized Outcomes**: Create action items and summaries tailored to specific participants

## Technology Stack

- **Next.js 15**: React framework for the frontend
- **Node.js**: Development runtime environment
- **Bun**: Package manager
- **Gemini**: AI service for diarization and voice recognition

## Running the Project Locally

### Prerequisites

- **Node.js** (runtime)
- **Bun** (package manager)
- **Gemini API Access**

### Environment Setup

Copy the `.env.sample` file to `.env` and update the values with your own credentials:

```bash
cp .env.sample .env
```

For production deployments, configure these environment variables in your deployment platform.

### Setup

```bash
# Clone the repository
git clone https://github.com/xrehpicx/standup.git
cd standup

# Install dependencies
bun install

# Run the development server
bun dev
```

Visit `http://localhost:3000` to access the platform.

## Roadmap

- **Integration with Issue Trackers**: Connect with task management systems
- **Auto Outcome Generation and Assignment**: Automatically assign action items to team members

## Contribution

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Released under the GPL-3.0 License. See `LICENSE` for more information.
