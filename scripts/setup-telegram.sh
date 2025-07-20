#!/bin/bash
# Telegram Bot Setup Anleitung und Helper

echo "🤖 Telegram Bot Setup für Terminüberwachung"
echo "============================================="
echo ""

# Schritt 1: Bot erstellen
echo "📱 Schritt 1: Bot erstellen"
echo "1. Öffne Telegram und suche nach '@BotFather'"
echo "2. Schreibe: /newbot"
echo "3. Folge den Anweisungen:"
echo "   - Bot Name: z.B. 'Terminüberwachung Bot'"
echo "   - Bot Username: z.B. 'terminueberwachung_bot' (muss auf _bot enden)"
echo "4. Kopiere den Bot Token (123456789:ABCdef...)"
echo ""

# Schritt 2: Chat-ID herausfinden
echo "📋 Schritt 2: Chat-ID herausfinden"
echo "Option A - Einzelperson:"
echo "1. Schreibe deinem Bot eine Nachricht (z.B. 'Hallo')"
echo "2. Führe aus:"
echo "   curl 'https://api.telegram.org/bot<BOT_TOKEN>/getUpdates'"
echo "3. Finde deine Chat-ID in der JSON-Antwort"
echo ""
echo "Option B - Gruppe:"
echo "1. Füge den Bot zur Gruppe hinzu"
echo "2. Schreibe in der Gruppe: '@dein_bot_name hallo'"
echo "3. Führe getUpdates aus (siehe oben)"
echo "4. Chat-ID ist negativ für Gruppen (z.B. -123456789)"
echo ""

# Interaktive Eingabe
read -p "Hast du bereits einen Bot Token? (j/n): " has_token

if [ "$has_token" = "j" ] || [ "$has_token" = "J" ]; then
    read -p "Bot Token eingeben: " bot_token
    
    echo ""
    echo "🔍 Prüfe Bot..."
    response=$(curl -s "https://api.telegram.org/bot$bot_token/getMe")
    
    if echo "$response" | grep -q '"ok":true'; then
        bot_name=$(echo "$response" | grep -o '"first_name":"[^"]*' | cut -d'"' -f4)
        bot_username=$(echo "$response" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
        echo "✅ Bot gefunden: $bot_name (@$bot_username)"
        echo ""
        
        # Updates abrufen
        echo "📥 Aktuelle Updates:"
        updates=$(curl -s "https://api.telegram.org/bot$bot_token/getUpdates")
        
        if echo "$updates" | grep -q '"message"'; then
            echo "$updates" | jq '.result[] | {chat_id: .message.chat.id, chat_type: .message.chat.type, from: .message.from.first_name, text: .message.text}' 2>/dev/null || echo "$updates"
            echo ""
            echo "💡 Tipp: Die 'chat_id' ist was du brauchst!"
        else
            echo "❌ Keine Nachrichten gefunden."
            echo "Schreibe erst deinem Bot eine Nachricht!"
        fi
        
        read -p "Chat-ID eingeben (z.B. 123456789): " chat_id
        
        if [ ! -z "$chat_id" ]; then
            echo ""
            echo "🧪 Teste Nachricht..."
            test_response=$(curl -s "https://api.telegram.org/bot$bot_token/sendMessage" \
                -d "chat_id=$chat_id" \
                -d "text=🎉 Terminüberwachung Bot erfolgreich konfiguriert!")
            
            if echo "$test_response" | grep -q '"ok":true'; then
                echo "✅ Test-Nachricht gesendet!"
                echo ""
                echo "🔧 Konfiguration für .env:"
                echo "TELEGRAM_BOT_TOKEN=$bot_token"
                echo "TELEGRAM_CHAT_ID=$chat_id"
                echo ""
                echo "📝 Füge diese Zeilen in deine .env Datei ein."
                
                # Optional: Direkt in .env schreiben
                read -p "Soll ich die .env Datei automatisch aktualisieren? (j/n): " update_env
                if [ "$update_env" = "j" ] || [ "$update_env" = "J" ]; then
                    # Backup erstellen
                    cp .env .env.backup
                    
                    # Aktualisiere .env
                    sed -i.bak "s/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$bot_token/" .env
                    sed -i.bak "s/TELEGRAM_CHAT_ID=.*/TELEGRAM_CHAT_ID=$chat_id/" .env
                    
                    echo "✅ .env Datei aktualisiert (Backup: .env.backup)"
                fi
            else
                echo "❌ Test-Nachricht fehlgeschlagen:"
                echo "$test_response"
            fi
        fi
    else
        echo "❌ Bot Token ungültig:"
        echo "$response"
    fi
else
    echo ""
    echo "📋 Anleitung:"
    echo "1. Gehe zu https://t.me/BotFather"
    echo "2. Schreibe: /newbot"
    echo "3. Folge den Anweisungen"
    echo "4. Führe dieses Script erneut aus"
fi

echo ""
echo "🔗 Nützliche Links:"
echo "- BotFather: https://t.me/BotFather"
echo "- Telegram Bot API: https://core.telegram.org/bots/api"
echo "- Web Telegram: https://web.telegram.org"
