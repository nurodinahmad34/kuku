async function menu(sock, sender, message) {
    const templates = `*✅   ᴍᴇɴᴜ ꜱᴄ ᴊᴘᴍ ✅ *

➽ ʟɪꜱᴛɢᴄ
➽ ᴊᴘᴍ
➽ ᴘᴜꜱʜᴋᴏɴᴛᴀᴋ

jangan lupa berkunjung ke grup https://t.me/trenadmvpn
`;
    await sock.sendMessage(sender, { text: templates });
}

module.exports = menu;
