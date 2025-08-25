const clc = require('cli-color');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getallgc(sock) {
    try {
        const groups = await sock.groupFetchAllParticipating();
        return Object.values(groups).map(group => ({
            id: group.id,
            name: group.subject,
            participants: group.participants?.length || 0
        }));
    } catch (error) {
        console.error("Gagal mengambil daftar grup:", error);
        return false;
    }
}

// Fungsi untuk extract link dari text
function extractLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}

// Fungsi untuk mendapatkan domain dari link
function getDomainFromUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return 'website';
    }
}

// Fungsi untuk mendapatkan thumbnail berdasarkan domain
function getThumbnailByDomain(domain) {
    const thumbnails = {
        'whatsapp.com': 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhE9lXKKSIcCekjL9o2RyPQ0qDDkGPUxAAPycvsjKiU-o_mweUILeaQemNax7-C858TPDLMipLQmXAU7KjbcJdvCoXAhb9JzqQiLUIaorvVTiANBvVn3rH0RW-MZ7SAuyBJSswNLj3z0t6Q_r-S3ybQZwC5yq8millZripX-4j2Kft1GBop2Ut2EVrWWDM/s700/logo191kb.png',
        'youtube.com': 'https://i.ibb.co/Lk2Q8bG/youtube-thumb.jpg',
        'instagram.com': 'https://i.ibb.co/0jQ8Z9L/instagram-thumb.jpg'
    };
    
    return thumbnails[domain] || 'https://i.ibb.co/0jQ8Z9L/default-thumb.jpg';
}

// Fungsi untuk mendeteksi jenis file
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    const imageExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExt = ['.mp4', '.avi', '.mov', '.mkv', '.3gp', '.wmv', '.flv'];
    const docExt = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    const textExt = ['.txt', '.rtf', '.md'];
    const archiveExt = ['.zip', '.rar', '.7z', '.tar', '.gz'];
    const configExt = ['.hc', '.conf', '.config', '.ini', '.json', '.xml', '.yaml', '.yml'];
    
    if (imageExt.includes(ext)) return 'image';
    if (videoExt.includes(ext)) return 'video';
    if (docExt.includes(ext)) return 'document';
    if (textExt.includes(ext)) return 'text';
    if (archiveExt.includes(ext)) return 'archive';
    if (configExt.includes(ext)) return 'config';
    
    return 'document';
}

// Fungsi untuk mendapatkan icon berdasarkan jenis file
function getFileIcon(fileType) {
    const icons = {
        'image': '📸',
        'video': '🎥',
        'document': '📄',
        'text': '📝',
        'archive': '📦',
        'config': '⚙️'
    };
    return icons[fileType] || '📁';
}

// Fungsi untuk mendapatkan semua file dari folder
function getAllFilesFromFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        return [];
    }
    
    const files = fs.readdirSync(folderPath);
    return files
        .filter(file => fs.statSync(path.join(folderPath, file)).isFile())
        .map(file => ({
            filename: file,
            path: path.join(folderPath, file),
            type: getFileType(file),
            icon: getFileIcon(getFileType(file))
        }));
}

async function jpm(sock, sender, messages, key, messageEvent) {
    const message = messageEvent.messages?.[0];
    let filesToSend = [];
    let captionText = '';

    // Handle utils
    let isImageMessage, downloadAndSaveMedia;
    try {
        const utils = require('../lib/utils');
        isImageMessage = utils.isImageMessage;
        downloadAndSaveMedia = utils.downloadAndSaveMedia;
        
        if (isImageMessage && isImageMessage(messageEvent)) {
            try {
                const filename = `${sender}_${Date.now()}.jpeg`;
                const result = await downloadAndSaveMedia(sock, message, filename);
                if (result) {
                    filesToSend.push({
                        path: `./tmp/${filename}`,
                        type: 'image',
                        filename: filename,
                        isTemporary: true,
                        icon: '📸'
                    });
                }
            } catch (error) {
                console.error("Error download gambar:", error);
            }
        }
    } catch (error) {
        console.log("Utils tidak ditemukan, lanjut tanpa fitur download media");
    }

    const parts = messages.trim().split(' ');
    const command = parts[0];

    // HELP MENU
    if (parts.length === 1 || parts[1] === 'help') {
        const helpText = `*📖 BANTUAN PERINTAH JPM*

➽ *jpm teks* - Kirim pesan teks ke semua grup
➽ *jpm delay 8000* - Kirim dengan jeda 8 detik
➽ *jpm category besar* - Kirim ke grup besar saja

*📁 FITUR FILE:*
• *jpm file all* - Kirim SEMUA file dari folder files
• *jpm file list* - Lihat daftar file yang tersedia
• *jpm file send nama-file.hc* - Kirim file tertentu

*📋 SUPPORT FILE:*
• Gambar (jpg, png, gif)
• Video (mp4, avi, mov) 
• Dokumen (pdf, doc, xls)
• Archive (zip, rar)
• Config (.hc, .conf, .json)
• Text (txt, md)

*Contoh:*
• jpm file all 📚 File konfigurasi dan materi
• jpm file send config.hc File config HTTPCustom`;

        return sock.sendMessage(sender, { text: helpText });
    }

    // === FITUR KIRIM FILE ===
    if (parts[1] === 'file') {
        if (parts[2] === 'all') {
            // Kirim SEMUA file dari folder files
            const allFiles = getAllFilesFromFolder('./files');
            
            if (allFiles.length === 0) {
                return sock.sendMessage(sender, { 
                    text: "❌ Folder 'files' kosong. Silakan taruh file-file Anda di folder './files' terlebih dahulu." 
                });
            }
            
            filesToSend = allFiles;
            captionText = parts.slice(3).join(' ') || '📁 Berikut file-file yang dibagikan:';
            
            await sock.sendMessage(sender, { 
                text: `📁 Akan mengirim ${allFiles.length} file ke semua grup...` 
            });
        }
        else if (parts[2] === 'list') {
            // List files yang tersedia
            const allFiles = getAllFilesFromFolder('./files');
            
            if (allFiles.length === 0) {
                return sock.sendMessage(sender, { 
                    text: "📁 Folder 'files' kosong. Silakan taruh file-file Anda di folder './files'" 
                });
            }
            
            const fileList = allFiles.map((file, index) => 
                `${index + 1}. ${file.icon} ${file.filename} (${file.type})`
            ).join('\n');
            
            return sock.sendMessage(sender, { 
                text: `*📁 DAFTAR SEMUA FILE:*\n\n${fileList}\n\nTotal: ${allFiles.length} file\n\nGunakan: *jpm file all* untuk kirim semua file` 
            });
        }
        else if (parts[2] === 'send' && parts[3]) {
            // Kirim file tertentu
            const filename = parts[3];
            const filePath = `./files/${filename}`;
            
            if (!fs.existsSync(filePath)) {
                return sock.sendMessage(sender, { text: `❌ File '${filename}' tidak ditemukan` });
            }
            
            const fileType = getFileType(filename);
            const fileIcon = getFileIcon(fileType);
            
            filesToSend = [{
                path: filePath,
                type: fileType,
                filename: filename,
                isTemporary: false,
                icon: fileIcon
            }];
            
            captionText = parts.slice(4).join(' ') || '';
        }
        else {
            return sock.sendMessage(sender, { 
                text: "❌ Format command salah. Gunakan:\n• jpm file all [caption]\n• jpm file list\n• jpm file send nama-file.hc [caption]" 
            });
        }
    }

    // Parse parameters untuk broadcast biasa
    const hasDelay = parts[1] === 'delay';
    const hasCategory = parts[1] === 'category';

    let text, delayTime, category;

    if (hasDelay) {
        delayTime = parseInt(parts[2]) || 10000;
        text = parts.slice(3).join(' ');
    } else if (hasCategory) {
        category = parts[2];
        text = parts.slice(3).join(' ');
    } else if (parts[1] !== 'file') {
        text = parts.slice(1).join(' ');
        delayTime = 10000;
    }

    captionText = captionText || text || '';

    // Deteksi link dalam pesan
    const links = extractLinks(captionText);
    const hasLinks = links.length > 0 && filesToSend.length === 0;

    await sock.sendMessage(sender, { react: { text: "⏰", key } });

    const groupList = await getallgc(sock);
    if (!groupList || groupList.length === 0) {
        return sock.sendMessage(sender, { text: "❌ Tidak ada grup yang ditemukan" });
    }

    // Filter groups
    let targetGroups = groupList;
    if (category) {
        const categories = {
            'besar': group => group.participants > 20,
            'kecil': group => group.participants <= 20,
            'semua': group => true
        };
        
        if (categories[category]) {
            targetGroups = groupList.filter(categories[category]);
        }
    }

    let successCount = 0;
    let failedCount = 0;
    const failedGroups = [];

    for (const group of targetGroups) {
        try {
            if (filesToSend.length > 0) {
                // KIRIM CAPTION TERLEBIH DAHULU
                if (captionText) {
                    await sock.sendMessage(group.id, { 
                        text: `📢 ${captionText}` 
                    });
                    await sleep(1000);
                }

                // KIRIM SEMUA FILE SATU PER SATU
                for (const file of filesToSend) {
                    try {
                        console.log(clc.blue(`📤 Mengirim ${file.type}: ${file.filename} ke ${group.name}`));
                        
                        let fileCaption = `${file.icon} ${file.filename}`;
                        
                        switch (file.type) {
                            case 'image':
                                await sock.sendMessage(group.id, {
                                    image: fs.readFileSync(file.path),
                                    caption: fileCaption
                                });
                                break;
                            case 'video':
                                await sock.sendMessage(group.id, {
                                    video: fs.readFileSync(file.path),
                                    caption: fileCaption
                                });
                                break;
                            default:
                                await sock.sendMessage(group.id, {
                                    document: fs.readFileSync(file.path),
                                    fileName: file.filename,
                                    caption: fileCaption,
                                    mimetype: 'application/octet-stream'
                                });
                        }
                        
                        await sleep(2000);
                    } catch (fileError) {
                        console.error(clc.red(`✗ Gagal kirim file ${file.filename}:`), fileError);
                    }
                }
            } 
            else if (hasLinks) {
                const firstLink = links[0];
                const domain = getDomainFromUrl(firstLink);
                const thumbnailUrl = getThumbnailByDomain(domain);
                
                await sock.sendMessage(group.id, {
                    text: captionText,
                    contextInfo: {
                        externalAdReply: {
                            title: `🔗 ${domain.toUpperCase()} LINK`,
                            body: 'Klik untuk membuka link ↗️',
                            mediaType: 1,
                            thumbnailUrl: thumbnailUrl,
                            sourceUrl: firstLink,
                            mediaUrl: firstLink,
                            showAdAttribution: false
                        }
                    }
                });
            } else {
                await sock.sendMessage(group.id, { text: captionText });
            }
            
            successCount++;
            console.log(clc.green(`✓ Berhasil kirim ke ${group.name}`));
        } catch (error) {
            failedCount++;
            failedGroups.push(group.name);
            console.log(clc.red(`✗ Gagal kirim ke ${group.name}: ${error.message}`));
        }

        await sleep(delayTime);
    }

    // Cleanup temporary files saja
    for (const file of filesToSend) {
        if (file.isTemporary && fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
                console.log(clc.yellow(`🗑️ Hapus file temporary: ${file.filename}`));
            } catch (error) {
                console.log("Gagal hapus file temporary:", error);
            }
        }
    }

    // Send report
    const report = `*📊 LAPORAN BROADCAST*
✅ Berhasil: ${successCount} grup
❌ Gagal: ${failedCount} grup
📋 Total: ${targetGroups.length} grup
⏱️ Jeda: ${delayTime || 8000}ms/grup
📁 File dikirim: ${filesToSend.length} file
🔗 Link terdeteksi: ${hasLinks ? 'Ya' : 'Tidak'}

${failedCount > 0 ? `*Grup yang Gagal:*\n${failedGroups.map(g => `• ${g}`).join('\n')}` : '🎉 Semua file berhasil terkirim!'}`;

    await sock.sendMessage(sender, { text: report });
    return sock.sendMessage(sender, { react: { text: "✅", key } });
}

module.exports = jpm;
