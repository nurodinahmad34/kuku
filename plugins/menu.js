async function menu(sock, sender, message) {
    const templates = `*✅  MENU ✅ *

➽ listgc
➽ jpm
➽ pushkontak

jangan lupa berkunjung ke grup https://t.me/trenadmvpn
`;
    await sock.sendMessage(sender, { text: templates });
}

module.exports = menu;
