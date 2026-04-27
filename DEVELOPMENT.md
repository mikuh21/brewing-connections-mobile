# Development Setup

**Backend:** https://brewing-hub.online (live on Railway)  
**Mobile:** Expo Go on iPhone, developed on Windows PowerShell

---

## Daily Development Workflow

### Start Development
1. Open Windows PowerShell
2. Navigate to mobile folder: `cd C:\brewhub\mobile`
3. Start Expo: `npx expo start`
4. Scan QR code with iPhone Camera app
5. Opens automatically in Expo Go

### API is already live
- No need for ngrok or local server
- API URL: https://brewing-hub.online
- All changes to backend require git push to redeploy

### End of Session - Sync to WSL for Git

Run these commands in PowerShell:

```powershell
xcopy "C:\brewhub\mobile\app" "\\wsl.localhost\Ubuntu\home\laravel-app\laravel-app\brewing-connections\mobile\app" /E /I /Y
copy "C:\brewhub\mobile\App.js" "\\wsl.localhost\Ubuntu\home\laravel-app\laravel-app\brewing-connections\mobile\App.js"
copy "C:\brewhub\mobile\package.json" "\\wsl.localhost\Ubuntu\home\laravel-app\laravel-app\brewing-connections\mobile\package.json"
```

Then in WSL terminal:

```bash
cd ~/laravel-app/brewing-connections/mobile
git add .
git commit -m "your message"
git push
```
