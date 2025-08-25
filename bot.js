const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { execSync } = require('child_process');
const https = require('https');

// بيانات البوت
const TOKEN = "8018964869:AAHevMgPMsip0CKx4-virvESUiNdcRRcKz8";
const ADMIN_ID = 6808883615;
const DEVELOPER_USERNAME = "@QR_l4";

// ملفات التخزين
const DATA_FILE = "bot_data.json";
const CHANNELS_FILE = "channels_data.json";

// APIs
const VIRUSTOTAL_API_KEY = "19462df75ad313db850e532a2e8869dc8713c07202b1c62ebf1aa7a18a2e0173";
const VIDEO_API_BASE = "https://api.yabes-desu.workers.dev/ai/tool/txt2video";
const SHORTENER_API = "https://api.dfkz.xo.je/apis/v1/short.php?url=";
const INSTA_INFO_API = "https://sherifbots.serv00.net/Api/insta.php?user=";
const AI_API_URL = 'https://ai-api.magicstudio.com/api/ai-art-generator';

// إعدادات أخرى
let COLUMNS = 2;
const DOWNLOAD_FOLDER = "site_download";
const ZIP_FILE_NAME = "site_download.zip";

// متغيرات صيد اليوزرات
const insta = "1234567890qwertyuiopasdfghjklzxcvbnm";
const all_chars = "_.";
const user_sessions = {};
const good_users_cache = {};

// لغات الترجمة المدعومة
const SUPPORTED_LANGUAGES = {
    "العربية": "ar",
    "الإنجليزية": "en",
    "الإسبانية": "es",
    "الفرنسية": "fr",
    "الألمانية": "de",
    "الإيطالية": "it",
    "البرتغالية": "pt",
    "الروسية": "ru",
    "الصينية": "zh",
    "اليابانية": "ja",
    "الكورية": "ko",
    "التركية": "tr",
    "الفارسية": "fa",
    "العبرية": "he"
};

// BINs شائعة للفيزا
const COMMON_VISA_BINS = [
    '453201', '453202', '453203', '453204', '453205', '453206', '453207', '453208', '453209',
    '453210', '453211', '453212', '453213', '453214', '453215', '453216', '453217', '453218',
    '453219', '453220', '453221', '453222', '453223', '453224', '453225', '453226', '453227',
    '453228', '453229', '453230', '453231', '453232', '453233', '453234', '453235', '453236',
    '453237', '453238', '453239', '453240', '453241', '453242', '453243', '453244', '453245',
    '453246', '453247', '453248', '453249', '453250', '453251', '453252', '453253', '453254',
    '453255', '453256', '453257', '453258', '453259', '453260', '453261', '453262', '453263',
    '453264', '453265', '453266', '453267', '453268', '453269', '453270', '453271', '453272',
    '453273', '453274', '453275', '453276', '453277', '453278', '453279', '453280', '453281',
    '453282', '453283', '453284', '453285', '453286', '453287', '453288', '453289', '453290',
    '453291', '453292', '453293', '453294', '453295', '453296', '453297', '453298', '453299',
    '454000', '454001', '454002', '454003', '454004', '454005', '454006', '454007', '454008',
    '454009', '454010', '454011', '454012', '454013', '454014', '454015', '454016', '454017',
    '454018', '454019', '454020', '454021', '454022', '454023', '454024', '454025', '454026',
    '454027', '454028', '454029', '454030', '454031', '454032', '454033', '454034', '454035',
    '454036', '454037', '454038', '454039', '454040', '454041', '454042', '454043', '454044',
    '454045', '454046', '454047', '454048', '454049', '454050', '454051', '454052', '454053',
    '454054', '454055', '454056', '454057', '454058', '454059', '454060', '454061', '454062',
    '454063', '454064', '454065', '454066', '454067', '454068', '454069', '454070', '454071',
    '454072', '454073', '454074', '454075', '454076', '454077', '454078', '454079', '454080',
    '454081', '454082', '454083', '454084', '454085', '454086', '454087', '454088', '454089',
    '454090', '454091', '454092', '454093', '454094', '454095', '454096', '454097', '454098',
    '454099'
];

// تحميل البيانات
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    return { 
        buttons: [], 
        services_order: ["translation", "visa", "image", "video", "tiktok", "file_check", "site_download", "shortener", "insta_info"] 
    };
}

function loadChannels() {
    if (fs.existsSync(CHANNELS_FILE)) {
        return JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
    }
    return { channels: [] };
}

// حفظ البيانات
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function saveChannels(data) {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(data, null, 2));
}

// تحقق من صلاحية المشرف
function isAdmin(userId) {
    return userId == ADMIN_ID;
}

// دالة لترتيب الأزرار في أعمدة
function arrangeButtonsInColumns(buttonsList, columns = COLUMNS) {
    const keyboard = [];
    for (let i = 0; i < buttonsList.length; i += columns) {
        const row = buttonsList.slice(i, i + columns);
        keyboard.push(row);
    }
    return keyboard;
}

// التحقق من اشتراك المستخدم في القنوات
async function checkSubscription(ctx, userId) {
    const channels = loadChannels().channels;
    
    if (!channels.length) {
        return true; // إذا لم توجد قنوات، نسمح بالاستخدام
    }
    
    const notSubscribed = [];
    
    for (const channel of channels) {
        try {
            const member = await ctx.telegram.getChatMember(channel.id, userId);
            if (member.status === 'left' || member.status === 'kicked') {
                notSubscribed.push(channel);
            }
        } catch (error) {
            console.error(`Error checking subscription for channel ${channel.id}: ${error}`);
            continue;
        }
    }
    
    if (notSubscribed.length) {
        // إنشاء رسالة مع أزرار الاشتراك
        const keyboard = [];
        for (const channel of notSubscribed) {
            const channelId = channel.id;
            const channelName = channel.name;
            const username = channel.username || "";
            
            let url;
            if (username) {
                url = `https://t.me/${username}`;
            } else {
                url = `https://t.me/c/${String(channelId).replace('-100', '')}`;
            }
            
            keyboard.push([Markup.button.url(`انضم إلى ${channelName}`, url)]);
        }
        
        keyboard.push([Markup.button.callback("✅ تحقق من الاشتراك", "check_subscription")]);
        
        const replyMarkup = Markup.inlineKeyboard(keyboard);
        
        await ctx.reply(
            "⚠️ يجب عليك الانضمام إلى القنوات التالية لاستخدام البوت:",
            replyMarkup
        );
        return false;
    }
    
    return true;
}

// تطبيق خوارزمية لوهن (Luhn algorithm) للتحقق من صحة رقم البطاقة
function luhnCheck(cardNumber) {
    function digitsOf(n) {
        return String(n).split('').map(Number);
    }
    
    const digits = digitsOf(cardNumber);
    const oddDigits = digits.reverse().filter((_, i) => i % 2 === 0);
    const evenDigits = digits.reverse().filter((_, i) => i % 2 === 1);
    let checksum = oddDigits.reduce((sum, digit) => sum + digit, 0);
    
    for (const d of evenDigits) {
        const doubled = d * 2;
        checksum += doubled > 9 ? doubled - 9 : doubled;
    }
    
    return checksum % 10 === 0;
}

// توليد رقم بطاقة صحيح باستخدام خوارزمية لوهن
function generateValidCard(bin) {
    // توليد الأرقام العشوائية
    const length = 16 - bin.length;
    const randomPart = Array.from({ length: length - 1 }, () => 
        Math.floor(Math.random() * 10)
    ).join('');
    
    // حساب checksum باستخدام خوارزمية لوهن
    const baseNumber = bin + randomPart;
    let checksum = 0;
    
    for (let i = 0; i < baseNumber.length; i++) {
        let n = parseInt(baseNumber[i]);
        if ((i + bin.length) % 2 === 0) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        checksum += n;
    }
    
    const checksumDigit = (10 - (checksum % 10)) % 10;
    return baseNumber + checksumDigit;
}

// توليد فيزا حقيقي مع بيانات واقعية
function generateRealisticVisa() {
    // اختيار BIN عشوائي من القائمة
    const bin = COMMON_VISA_BINS[Math.floor(Math.random() * COMMON_VISA_BINS.length)];
    
    // توليد رقم بطاقة صحيح
    const cardNumber = generateValidCard(bin);
    
    // تنسيق الرقم للعرض
    const formattedNumber = cardNumber.match(/.{1,4}/g).join(' ');
    
    // توليد تاريخ انتهاء واقعي (ليس في الماضي)
    const currentYear = 2024;
    const month = Math.floor(Math.random() * 12) + 1;
    const year = Math.floor(Math.random() * 6) + currentYear;
    
    // تنسيق التاريخ
    const expiryDate = `${month.toString().padStart(2, '0')}/${String(year).slice(2)}`;
    
    // توليد CVV واقعي
    const cvv = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // توليد اسم حامل البطاقة (عشوائي)
    const firstNames = ["AHMED", "MOHAMMED", "ALI", "OMAR", "KHALED", "HASSAN", "HUSSEIN", "IBRAHIM", "YOUSEF", "ABDULLAH"];
    const lastNames = ["ALI", "HASSAN", "HUSSEIN", "ABDULRAHMAN", "ALSAUD", "ALGHAMDI", "ALOTAIBI", "ALAMRI", "ALSHEHRI", "ALZAHRANI"];
    
    const cardHolder = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    
    return [formattedNumber, expiryDate, cvv, cardHolder];
}

// ترجمة النص إلى الإنجليزية
async function translateToEnglish(text) {
    try {
        const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const response = await axios.get(translateUrl);
        return response.data[0][0][0];
    } catch (error) {
        console.error(`Translation error: ${error}`);
        return text; // إذا فشلت الترجمة، نعود للنص الأصلي
    }
}

// إنشاء صورة باستخدام الذكاء الاصطناعي
async function createAiImage(prompt) {
    try {
        const headers = {
            "accept": "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9,ar;q=0.8",
            "origin": "https://magicstudio.com",
            "priority": "u=1, i",
            "referer": "https://magicstudio.com/ai-art-generator/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
        };
        
        const data = {
            'prompt': prompt,
            'output_format': 'bytes',
            'user_profile_id': 'null',
            'user_is_subscribed': 'true'
        };
        
        const response = await axios.post(AI_API_URL, data, { headers, responseType: 'arraybuffer' });
        return response.data;
    } catch (error) {
        console.error(`AI Image generation error: ${error}`);
        throw error;
    }
}

// وظائف إنشاء الفيديو
async function fetchVideoToTemp(prompt) {
    const url = `${VIDEO_API_BASE}?prompt=${encodeURIComponent(prompt)}`;
    
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 1200000 // 20 دقيقة
        });
        
        if (response.status !== 200) {
            throw new Error(`API error ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers['content-type'] || '';
        const tempFilePath = path.join(__dirname, `${uuidv4()}.mp4`);
        const writer = fs.createWriteStream(tempFilePath);
        
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(tempFilePath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Video generation error: ${error}`);
        throw error;
    }
}

// وظائف صيد يوزرات انستجرام
async function checkInstagramUser(user) {
    const url = 'https://www.instagram.com/accounts/web_create_ajax/attempt/';
    
    const headers = {
        'Host': 'www.instagram.com',
        'content-length': '85',
        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="101"',
        'x-ig-app-id': '936619743392459',
        'x-ig-www-claim': '0',
        'sec-ch-ua-mobile': '?0',
        'x-instagram-ajax': '81f3a3c9dfe2',
        'content-type': 'application/x-www-form-urlencoded',
        'accept': '*/*',
        'x-requested-with': 'XMLHttpRequest',
        'x-asbd-id': '198387',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.40 Safari/537.36',
        'x-csrftoken': 'jzhjt4G11O37lW1aDFyFmy1K0yIEN9Qv',
        'sec-ch-ua-platform': '"Linux"',
        'origin': 'https://www.instagram.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://www.instagram.com/accounts/emailsignup/',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-IQ,en;q=0.9',
        'cookie': 'csrftoken=jzhjt4G11O37lW1aDFyFmy1K0yIEN9Qv; mid=YtsQ1gABAAEszHB5wT9VqccwQIUL; ig_did=227CCCC2-3675-4A04-8DA5-BA3195B46425; ig_nrcb=1'
    };
    
    const data = `email=aakmnnsjskksmsnsn%40gmail.com&username=${user}&first_name=&opt_into_one_tap=false`;
    
    try {
        const response = await axios.post(url, data, { headers, timeout: 10000 });
        const responseText = JSON.stringify(response.data);
        
        if (responseText.includes('{"message":"feedback_required","spam":true,')) {
            return false;
        } else if (responseText.includes('"errors": {"username":') || responseText.includes('"code": "username_is_taken"')) {
            return false;
        } else {
            return true;
        }
    } catch (error) {
        console.error(`Error checking user ${user}: ${error}`);
        return false;
    }
}

function generate4charUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.3) {
            users.push(Array.from({ length: 4 }, () => insta[Math.floor(Math.random() * insta.length)]).join(''));
        } else {
            const numSymbols = Math.floor(Math.random() * 2) + 1;
            const positions = Array.from({ length: 4 }, (_, i) => i)
                .sort(() => 0.5 - Math.random())
                .slice(0, numSymbols);
            
            const userChars = [];
            for (let j = 0; j < 4; j++) {
                if (positions.includes(j)) {
                    userChars.push(all_chars[Math.floor(Math.random() * all_chars.length)]);
                } else {
                    userChars.push(insta[Math.floor(Math.random() * insta.length)]);
                }
            }
            users.push(userChars.join(''));
        }
    }
    return users;
}

function generate5charUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.4) {
            users.push(Array.from({ length: 5 }, () => insta[Math.floor(Math.random() * insta.length)]).join(''));
        } else {
            const numSymbols = Math.floor(Math.random() * 3) + 1;
            const positions = Array.from({ length: 5 }, (_, i) => i)
                .sort(() => 0.5 - Math.random())
                .slice(0, numSymbols);
            
            const userChars = [];
            for (let j = 0; j < 5; j++) {
                if (positions.includes(j)) {
                    userChars.push(all_chars[Math.floor(Math.random() * all_chars.length)]);
                } else {
                    userChars.push(insta[Math.floor(Math.random() * insta.length)]);
                }
            }
            users.push(userChars.join(''));
        }
    }
    return users;
}

function generateSpecialUsers(count, length = 6) {
    const users = [];
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.2) {
            users.push(Array.from({ length }, () => insta[Math.floor(Math.random() * insta.length)]).join(''));
        } else {
            const numSymbols = Math.floor(Math.random() * 3) + 2;
            const positions = Array.from({ length }, (_, i) => i)
                .sort(() => 0.5 - Math.random())
                .slice(0, numSymbols);
            
            const userChars = [];
            for (let j = 0; j < length; j++) {
                if (positions.includes(j)) {
                    userChars.push(all_chars[Math.floor(Math.random() * all_chars.length)]);
                } else {
                    userChars.push(insta[Math.floor(Math.random() * insta.length)]);
                }
            }
            users.push(userChars.join(''));
        }
    }
    return users;
}

function generateEasy4charUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.1) {
            users.push(Array.from({ length: 4 }, () => insta[Math.floor(Math.random() * insta.length)]).join(''));
        } else {
            const positions = Array.from({ length: 4 }, (_, i) => i)
                .sort(() => 0.5 - Math.random())
                .slice(0, 2);
            
            const userChars = [];
            for (let j = 0; j < 4; j++) {
                if (positions.includes(j)) {
                    userChars.push(all_chars[Math.floor(Math.random() * all_chars.length)]);
                } else {
                    userChars.push(insta[Math.floor(Math.random() * insta.length)]);
                }
            }
            users.push(userChars.join(''));
        }
    }
    return users;
}

async function checkUsersBatch(users) {
    const goodUsers = [];
    for (const user of users) {
        if (await checkInstagramUser(user)) {
            goodUsers.push(user);
            if (goodUsers.length >= 5) break;
        }
    }
    return goodUsers;
}

async function instagramCheckProcess(chatId, bot, userType) {
    user_sessions[chatId] = true;
    let totalChecked = 0;
    let foundUsers = 0;
    
    const typeName = userType === "5char" ? "خماسية" : 
                    userType === "4char" ? "رباعية" : 
                    userType === "easy4char" ? "رباعية سهلة" : "خاصة";
    
    await bot.telegram.sendMessage(chatId, `🔍 بدء البحث عن 5 يوزرات ${typeName} متاحة...`);
    
    while (user_sessions[chatId] && foundUsers < 5) {
        let usersBatch;
        if (userType === "5char") {
            usersBatch = generate5charUsers(15);
        } else if (userType === "4char") {
            usersBatch = generate4charUsers(15);
        } else if (userType === "easy4char") {
            usersBatch = generateEasy4charUsers(15);
        } else {
            usersBatch = generateSpecialUsers(15);
        }
        
        const goodUsers = await checkUsersBatch(usersBatch);
        totalChecked += usersBatch.length;
        
        if (!good_users_cache[chatId]) {
            good_users_cache[chatId] = [];
        }
        
        for (const user of goodUsers) {
            if (!good_users_cache[chatId].includes(user)) {
                good_users_cache[chatId].push(user);
                foundUsers++;
                
                const symbolCount = user.split('').filter(char => all_chars.includes(char)).length;
                let userTypeDesc = "";
                if (symbolCount === 0) {
                    userTypeDesc = "بدون رموز";
                } else if (symbolCount === 1) {
                    userTypeDesc = "برمز واحد";
                } else if (symbolCount === 2) {
                    userTypeDesc = "برمزين";
                } else {
                    userTypeDesc = `ب${symbolCount} رموز`;
                }
                
                const message = `✅ يوزر Instagram متاح!

📝 اليوزر: \`${user}\`
🔢 النوع: ${typeName} (${userTypeDesc})
🎯 الحاية: متاح للتسجيل

💾 اليوزر ${foundUsers} من 5`;
                
                await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
                if (foundUsers >= 5) break;
            }
        }
        
        if (foundUsers >= 5) break;
    }
    
    let finalMessage;
    if (foundUsers > 0) {
        const usersList = good_users_cache[chatId].slice(-foundUsers).map(user => `• \`${user}\``).join('\n');
        finalMessage = `🎉 تم العثور على ${foundUsers} يوزر متاح!

${usersList}

📊 إجمالي المفحوصة: ${totalChecked}`;
    } else {
        finalMessage = `❌ لم يتم العثور على يوزرات متاحة

📊 إجمالي المفحوصة: ${totalChecked}`;
    }
    
    await bot.telegram.sendMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
    user_sessions[chatId] = false;
}

// دالة جلب معلومات تيك توك
async function getTikTokInfo(username) {
    const apiUrl = `https://tik-batbyte.vercel.app/tiktok?username=${username}`;
    try {
        const response = await axios.get(apiUrl, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`TikTok API error: ${error}`);
        return {};
    }
}

// فحص الملف باستخدام VirusTotal
async function checkFileWithVirusTotal(fileBuffer, fileName) {
    try {
        const formData = new FormData();
        formData.append('file', fileBuffer, fileName);
        
        const headers = {
            'x-apikey': VIRUSTOTAL_API_KEY,
            ...formData.getHeaders()
        };
        
        const uploadUrl = "https://www.virustotal.com/api/v3/files";
        const uploadResponse = await axios.post(uploadUrl, formData, { headers });
        const analysisId = uploadResponse.data.data.id;

        // الانتظار حتى تجهز النتيجة
        const analysisUrl = `https://www.virustotal.com/api/v3/analyses/${analysisId}`;
        let result;
        let status;
        
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const analysisResponse = await axios.get(analysisUrl, { headers: { 'x-apikey': VIRUSTOTAL_API_KEY } });
            result = analysisResponse.data;
            status = result.data.attributes.status;
            if (status === "completed") break;
        }

        const stats = result.data.attributes.stats;
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const harmless = stats.harmless || 0;
        const undetected = stats.undetected || 0;
        const sha256 = result.meta.file_info.sha256;

        return {
            malicious,
            suspicious,
            harmless,
            undetected,
            sha256,
            success: true
        };
    } catch (error) {
        console.error(`VirusTotal error: ${error}`);
        return { success: false, error: error.message };
    }
}

// وظائف سحب ملفات الموقع
function cleanupSiteFiles(zipPath, folderPath) {
    setTimeout(() => {
        try {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
        } catch (error) {
            console.error(`Error cleaning up site files: ${error}`);
        }
    }, 180000); // تنظيف الملفات بعد 3 دقائق
}

function downloadSiteSimple(url, folder) {
    try {
        // تنظيف المجلد إذا كان موجوداً
        if (fs.existsSync(folder)) {
            fs.rmSync(folder, { recursive: true, force: true });
        }
        fs.mkdirSync(folder, { recursive: true });
        
        // تنزيل الصفحة الرئيسية فقط
        const response = axios.get(url, { timeout: 30000 });
        
        // استخراج اسم الملف من الرابط
        const parsedUrl = new URL(url);
        let filename = path.basename(parsedUrl.pathname);
        if (!filename || !path.extname(filename)) {
            filename = "index.html";
        }
        
        // حفظ الصفحة الرئيسية
        const mainFile = path.join(folder, filename);
        fs.writeFileSync(mainFile, response.data, 'utf8');
        
        return true;
    } catch (error) {
        console.error(`Error downloading site: ${error}`);
        return false;
    }
}

function zipFolderSite(folder, zipName) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipName);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', resolve);
        archive.on('error', reject);
        
        archive.pipe(output);
        archive.directory(folder, false);
        archive.finalize();
    });
}

// إنشاء لوحة المفاتيح الرئيسية مع الترتيب المطلوب
function createMainKeyboard(userId) {
    const data = loadData();
    const keyboard = [];
    
    // إضافة أزرار المواقع أولاً
    const buttonsList = data.buttons.map(btn => 
        Markup.button.webApp(btn.text, btn.url)
    );
    
    // ترتيب أزرار المواقع في أعمدة
    if (buttonsList.length) {
        keyboard.push(...arrangeButtonsInColumns(buttonsList));
    }
    
    // إضافة أزرار الخدمات حسب الترتيب المحدد
    const servicesOrder = data.services_order || ["translation", "visa", "image", "video", "tiktok", "file_check", "site_download", "shortener", "insta_info"];
    const serviceButtons = [];
    
    for (const service of servicesOrder) {
        if (service === "translation") {
            serviceButtons.push(Markup.button.callback("خدمة الترجمة 🌐", "translation_service"));
        } else if (service === "visa") {
            serviceButtons.push(Markup.button.callback("توليد فيزا 💳", "generate_visa"));
        } else if (service === "image") {
            serviceButtons.push(Markup.button.callback("إنشاء صورة 🎨", "generate_image"));
        } else if (service === "video") {
            serviceButtons.push(Markup.button.callback("إنشاء فيديو 🎬", "generate_video"));
        } else if (service === "tiktok") {
            serviceButtons.push(Markup.button.callback("معلومات تيك توك 📱", "tiktok_service"));
        } else if (service === "file_check") {
            serviceButtons.push(Markup.button.callback("فحص الملفات 🔍", "file_check_service"));
        } else if (service === "site_download") {
            serviceButtons.push(Markup.button.callback("سحب ملفات الموقع 🌐", "site_download_service"));
        } else if (service === "shortener") {
            serviceButtons.push(Markup.button.callback("اختصار الروابط 🔗", "shortener_service"));
        } else if (service === "insta_info") {
            serviceButtons.push(Markup.button.callback("معلومات انستجرام 📷", "insta_info_service"));
        }
    }
    
    // ترتيب أزرار الخدمات في أعمدة
    if (serviceButtons.length) {
        keyboard.push(...arrangeButtonsInColumns(serviceButtons));
    }
    
    // إضافة الأزرار الثابتة الجديدة
    keyboard.push([Markup.button.callback("صيد يوزرات انستا 🎯", "instagram_hunt")]);
    keyboard.push([Markup.button.url("المزيد من المميزات 🦾", "https://t.me/VIP_H3bot")]);
    keyboard.push([Markup.button.url("مطور البوت 👑", `https://t.me/${DEVELOPER_USERNAME.replace('@', '')}`)]);
    
    // إضافة زر الإدارة للمشرف فقط
    if (isAdmin(userId)) {
        keyboard.push([Markup.button.callback("الإدارة ⚙️", "admin_panel")]);
    }
    
    return Markup.inlineKeyboard(keyboard);
}

// تهيئة البوت
const bot = new Telegraf(TOKEN);

// استخدام الجلسات
bot.use(session());

// أمر البدء
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const replyMarkup = createMainKeyboard(userId);
    
    await ctx.reply(
        "مرحباً! يمكنك التمتع بالخدمات واختيار ما يناسبك من الخيارات المتاحة:",
        replyMarkup
    );
});

// معالجة الأزرار
bot.action('admin_panel', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply("ليس لديك صلاحية للوصول إلى هذه اللوحة.");
        return;
    }
    
    const keyboard = [
        [Markup.button.callback("إضافة زر ➕", "add_button")],
        [Markup.button.callback("حذف زر ➖", "delete_button")],
        [Markup.button.callback("تغيير عدد الأعمدة 🔢", "change_columns")],
        [Markup.button.callback("ترتيب الخدمات 🔄", "reorder_services")],
        [Markup.button.callback("إدارة القنوات 📢", "manage_channels")],
        [Markup.button.callback("العودة ↩️", "back_to_main")]
    ];
    
    await ctx.editMessageText(
        "لوحة تحكم المشرف:",
        Markup.inlineKeyboard(keyboard)
    );
});

bot.action('generate_visa', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const [cardNumber, expiry, cvv, cardHolder] = generateRealisticVisa();
    
    await ctx.reply(
        `💳 **بطاقة فيزا محاكاة:**\n\n` +
        `**الرقم:** \`${cardNumber}\`\n` +
        `**تاريخ الانتهاء:** \`${expiry}\`\n` +
        `**CVV:** \`${cvv}\`\n` +
        `**حامل البطاقة:** \`${cardHolder}\`\n\n`,
        { parse_mode: "Markdown" }
    );
});

bot.action('generate_image', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "🎨 أرسل لي وصف الصورة التي تريد إنشاءها (بالعربية أو الإنجليزية):",
        Markup.forceReply()
    );
    
    ctx.session.waitingForImagePrompt = true;
});

bot.action('generate_video', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "🎬 أرسل لي وصف الفيديو الذي تريد إنشاءه (بالعربية أو الإنجليزية):",
        Markup.forceReply()
    );
    
    ctx.session.waitingForVideoPrompt = true;
});

bot.action('tiktok_service', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "📱 أرسل اسم المستخدم على تيك توك:",
        Markup.forceReply()
    );
    
    ctx.session.waitingForTikTokUsername = true;
});

bot.action('file_check_service', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "🔍 أرسل الملف الذي تريد فحصه (حتى 32 ميجابايت):",
        Markup.forceReply()
    );
    
    ctx.session.waitingForFileCheck = true;
});

bot.action('site_download_service', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "🌐 أرسل رابط الموقع الذي تريد سحب ملفاته:",
        Markup.forceReply()
    );
    
    ctx.session.waitingForSiteUrl = true;
});

bot.action('shortener_service', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "🔗 أرسل الرابط الذي تريد اختصاره:",
        Markup.forceReply()
    );
    
    ctx.session.waitingForShortenerUrl = true;
});

bot.action('insta_info_service', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.reply(
        "📷 أرسل اسم المستخدم على انستجرام:",
        Markup.forceReply()
    );
    
    ctx.session.waitingForInstaUsername = true;
});

bot.action('translation_service', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    // إنشاء لوحة مفاتيح للغات
    const languageButtons = Object.keys(SUPPORTED_LANGUAGES).map(lang => 
        Markup.button.callback(lang, `translate_to_${SUPPORTED_LANGUAGES[lang]}`)
    );
    
    const keyboard = arrangeButtonsInColumns(languageButtons, 2);
    keyboard.push([Markup.button.callback("العودة ↩️", "back_to_main")]);
    
    await ctx.editMessageText(
        "🌐 اختر اللغة الهدف للترجمة:",
        Markup.inlineKeyboard(keyboard)
    );
});

bot.action('instagram_hunt', async (ctx) => {
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const keyboard = [
        [Markup.button.callback("يوزرات رباعية 🎯", "hunt_4char")],
        [Markup.button.callback("يوزرات خماسية 🎯", "hunt_5char")],
        [Markup.button.callback("يوزرات رباعية سهلة 🎯", "hunt_easy4char")],
        [Markup.button.callback("يوزرات خاصة 🎯", "hunt_special")],
        [Markup.button.callback("العودة ↩️", "back_to_main")]
    ];
    
    await ctx.editMessageText(
        "🎯 اختر نوع اليوزرات التي تريد صيدها:",
        Markup.inlineKeyboard(keyboard)
    );
});

// معالجة أنواع صيد اليوزرات
bot.action('hunt_4char', async (ctx) => {
    await instagramCheckProcess(ctx.from.id, bot, "4char");
});

bot.action('hunt_5char', async (ctx) => {
    await instagramCheckProcess(ctx.from.id, bot, "5char");
});

bot.action('hunt_easy4char', async (ctx) => {
    await instagramCheckProcess(ctx.from.id, bot, "easy4char");
});

bot.action('hunt_special', async (ctx) => {
    await instagramCheckProcess(ctx.from.id, bot, "special");
});

// معالجة الترجمة للغات المختلفة
Object.values(SUPPORTED_LANGUAGES).forEach(lang => {
    bot.action(`translate_to_${lang}`, async (ctx) => {
        ctx.session.targetLanguage = lang;
        await ctx.reply(
            `🌐 تم اختيار اللغة. أرسل النص الذي تريد ترجمته إلى ${Object.keys(SUPPORTED_LANGUAGES).find(key => SUPPORTED_LANGUAGES[key] === lang)}:`,
            Markup.forceReply()
        );
    });
});

// معالجة الردود على الرسائل
bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    const messageText = ctx.message.text;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    // معالجة طلبات إنشاء الصور
    if (ctx.session.waitingForImagePrompt) {
        ctx.session.waitingForImagePrompt = false;
        
        await ctx.reply("⏳ جاري إنشاء الصورة...");
        
        try {
            // ترجمة النص إلى الإنجليزية إذا كان بالعربية
            let prompt = messageText;
            if (/[\u0600-\u06FF]/.test(prompt)) {
                prompt = await translateToEnglish(prompt);
            }
            
            const imageBuffer = await createAiImage(prompt);
            await ctx.replyWithPhoto({ source: imageBuffer }, { caption: "🎨 تم إنشاء الصورة بنجاح!" });
        } catch (error) {
            console.error(`Image generation error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء إنشاء الصورة. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات إنشاء الفيديو
    if (ctx.session.waitingForVideoPrompt) {
        ctx.session.waitingForVideoPrompt = false;
        
        await ctx.reply("⏳ جاري إنشاء الفيديو... قد تستغرق هذه العملية بعض الوقت.");
        
        try {
            // ترجمة النص إلى الإنجليزية إذا كان بالعربية
            let prompt = messageText;
            if (/[\u0600-\u06FF]/.test(prompt)) {
                prompt = await translateToEnglish(prompt);
            }
            
            const videoPath = await fetchVideoToTemp(prompt);
            await ctx.replyWithVideo({ source: videoPath }, { caption: "🎬 تم إنشاء الفيديو بنجاح!" });
            
            // تنظيف الملف المؤقت
            fs.unlinkSync(videoPath);
        } catch (error) {
            console.error(`Video generation error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء إنشاء الفيديو. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات معلومات تيك توك
    if (ctx.session.waitingForTikTokUsername) {
        ctx.session.waitingForTikTokUsername = false;
        
        await ctx.reply("⏳ جاري جلب معلومات الحساب...");
        
        try {
            const username = messageText.replace('@', '');
            const userInfo = await getTikTokInfo(username);
            
            if (userInfo && userInfo.user) {
                const info = userInfo.user;
                const stats = userInfo.stats || {};
                
                let message = `📱 **معلومات حساب تيك توك:**\n\n`;
                message += `👤 **اسم المستخدم:** ${info.uniqueId || 'غير متوفر'}\n`;
                message += `📛 **الاسم:** ${info.nickname || 'غير متوفر'}\n`;
                message += `📝 **البايو:** ${info.signature || 'غير متوفر'}\n\n`;
                
                message += `📊 **الإحصائيات:**\n`;
                message += `👀 **المتابعون:** ${stats.followerCount || 0}\n`;
                message += `❤️ **الإعجابات:** ${stats.heartCount || 0}\n`;
                message += `📹 **عدد الفيديوهات:** ${stats.videoCount || 0}\n\n`;
                
                message += `🔗 **رابط الحساب:** https://www.tiktok.com/@${info.uniqueId || username}`;
                
                await ctx.reply(message, { parse_mode: "Markdown" });
            } else {
                await ctx.reply("❌ لم يتم العثور على معلومات لهذا الحساب.");
            }
        } catch (error) {
            console.error(`TikTok info error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء جلب معلومات الحساب. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات فحص الملفات
    if (ctx.session.waitingForFileCheck && ctx.message.document) {
        ctx.session.waitingForFileCheck = false;
        
        const fileId = ctx.message.document.file_id;
        const fileName = ctx.message.document.file_name;
        const fileSize = ctx.message.document.file_size;
        
        // التحقق من حجم الملف (32MB كحد أقصى)
        if (fileSize > 32 * 1024 * 1024) {
            await ctx.reply("❌ حجم الملف كبير جداً. الحد الأقصى المسموح به هو 32 ميجابايت.");
            return;
        }
        
        await ctx.reply("⏳ جاري فحص الملف... قد تستغرق هذه العملية بعض الوقت.");
        
        try {
            const fileLink = await ctx.telegram.getFileLink(fileId);
            const response = await axios({ url: fileLink, responseType: 'arraybuffer' });
            const fileBuffer = Buffer.from(response.data);
            
            const result = await checkFileWithVirusTotal(fileBuffer, fileName);
            
            if (result.success) {
                let message = `🔍 **نتيجة فحص الملف:**\n\n`;
                message += `📄 **اسم الملف:** ${fileName}\n`;
                message += `🔢 **الحجم:** ${(fileSize / 1024 / 1024).toFixed(2)} ميجابايت\n\n`;
                
                message += `📊 **نتائج الفحص:**\n`;
                message += `🟢 **نظيف:** ${result.harmless}\n`;
                message += `🔴 **ضار:** ${result.malicious}\n`;
                message += `🟡 **مشبوه:** ${result.suspicious}\n`;
                message += `⚪ **غير مفحوص:** ${result.undetected}\n\n`;
                
                if (result.malicious > 0 || result.suspicious > 0) {
                    message += `⚠️ **تحذير:** هذا الملف قد يكون ضاراً!\n`;
                } else {
                    message += `✅ **آمن:** هذا الملف يبدو آمناً للاستخدام.\n`;
                }
                
                message += `\n🔐 **بصمة الملف (SHA256):**\n\`${result.sha256}\``;
                
                await ctx.reply(message, { parse_mode: "Markdown" });
            } else {
                await ctx.reply("❌ حدث خطأ أثناء فحص الملف. يرجى المحاولة مرة أخرى.");
            }
        } catch (error) {
            console.error(`File check error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء فحص الملف. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات سحب ملفات الموقع
    if (ctx.session.waitingForSiteUrl) {
        ctx.session.waitingForSiteUrl = false;
        
        let url = messageText;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        await ctx.reply("⏳ جاري سحب ملفات الموقع...");
        
        try {
            const folderPath = path.join(__dirname, DOWNLOAD_FOLDER);
            const zipPath = path.join(__dirname, ZIP_FILE_NAME);
            
            const success = downloadSiteSimple(url, folderPath);
            
            if (success) {
                await zipFolderSite(folderPath, zipPath);
                
                await ctx.replyWithDocument(
                    { source: zipPath },
                    { caption: "🌐 تم سحب ملفات الموقع بنجاح!" }
                );
                
                // تنظيف الملفات بعد الإرسال
                cleanupSiteFiles(zipPath, folderPath);
            } else {
                await ctx.reply("❌ حدث خطأ أثناء سحب ملفات الموقع. يرجى المحاولة مرة أخرى.");
            }
        } catch (error) {
            console.error(`Site download error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء سحب ملفات الموقع. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات اختصار الروابط
    if (ctx.session.waitingForShortenerUrl) {
        ctx.session.waitingForShortenerUrl = false;
        
        let url = messageText;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        await ctx.reply("⏳ جاري اختصار الرابط...");
        
        try {
            const shortUrl = await axios.get(`${SHORTENER_API}${encodeURIComponent(url)}`);
            
            if (shortUrl.data && shortUrl.data.shortUrl) {
                await ctx.reply(`🔗 **الرابط المختصر:**\n${shortUrl.data.shortUrl}`, { parse_mode: "Markdown" });
            } else {
                await ctx.reply("❌ حدث خطأ أثناء اختصار الرابط. يرجى المحاولة مرة أخرى.");
            }
        } catch (error) {
            console.error(`URL shortening error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء اختصار الرابط. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات معلومات انستجرام
    if (ctx.session.waitingForInstaUsername) {
        ctx.session.waitingForInstaUsername = false;
        
        const username = messageText.replace('@', '');
        
        await ctx.reply("⏳ جاري جلب معلومات الحساب...");
        
        try {
            const userInfo = await axios.get(`${INSTA_INFO_API}${username}`);
            
            if (userInfo.data && userInfo.data.status === "success") {
                const data = userInfo.data.data;
                
                let message = `📷 **معلومات حساب انستجرام:**\n\n`;
                message += `👤 **اسم المستخدم:** ${data.username || 'غير متوفر'}\n`;
                message += `📛 **الاسم الكامل:** ${data.full_name || 'غير متوفر'}\n`;
                message += `📝 **البايو:** ${data.biography || 'غير متوفر'}\n\n`;
                
                message += `📊 **الإحصائيات:**\n`;
                message += `👀 **المتابعون:** ${data.followers || 0}\n`;
                message += `❤️ **يتبع:** ${data.following || 0}\n`;
                message += `📹 **عدد المنشورات:** ${data.posts || 0}\n\n`;
                
                message += `🔗 **رابط الحساب:** https://www.instagram.com/${data.username}/`;
                
                await ctx.reply(message, { parse_mode: "Markdown" });
            } else {
                await ctx.reply("❌ لم يتم العثور على معلومات لهذا الحساب.");
            }
        } catch (error) {
            console.error(`Instagram info error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء جلب معلومات الحساب. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // معالجة طلبات الترجمة
    if (ctx.session.targetLanguage) {
        const targetLang = ctx.session.targetLanguage;
        ctx.session.targetLanguage = null;
        
        await ctx.reply("⏳ جاري الترجمة...");
        
        try {
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(messageText)}`;
            const response = await axios.get(translateUrl);
            
            if (response.data && response.data[0] && response.data[0][0] && response.data[0][0][0]) {
                const translatedText = response.data[0][0][0];
                const sourceLang = response.data[2];
                
                const languageName = Object.keys(SUPPORTED_LANGUAGES).find(key => SUPPORTED_LANGUAGES[key] === targetLang);
                
                await ctx.reply(
                    `🌐 **الترجمة إلى ${languageName}:**\n\n` +
                    `${translatedText}\n\n` +
                    `_(تمت الترجمة من ${sourceLang})_`,
                    { parse_mode: "Markdown" }
                );
            } else {
                await ctx.reply("❌ حدث خطأ أثناء الترجمة. يرجى المحاولة مرة أخرى.");
            }
        } catch (error) {
            console.error(`Translation error: ${error}`);
            await ctx.reply("❌ حدث خطأ أثناء الترجمة. يرجى المحاولة مرة أخرى.");
        }
        return;
    }
    
    // إذا لم تكن الرسالة جزءاً من أي عملية، عرض القائمة الرئيسية
    const replyMarkup = createMainKeyboard(userId);
    await ctx.reply(
        "اختر من الخيارات المتاحة:",
        replyMarkup
    );
});

// معالجة الزر العودة للقائمة الرئيسية
bot.action('back_to_main', async (ctx) => {
    const userId = ctx.from.id;
    const replyMarkup = createMainKeyboard(userId);
    
    await ctx.editMessageText(
        "مرحباً! يمكنك التمتع بالخدمات واختيار ما يناسبك من الخيارات المتاحة:",
        replyMarkup
    );
});

// معالجة الزر للتحقق من الاشتراك
bot.action('check_subscription', async (ctx) => {
    const userId = ctx.from.id;
    
    if (await checkSubscription(ctx, userId)) {
        const replyMarkup = createMainKeyboard(userId);
        await ctx.editMessageText(
            "✅ تم التحقق من الاشتراك! يمكنك الآن استخدام البوت.",
            replyMarkup
        );
    } else {
        await ctx.answerCbQuery("لم تنضم بعد إلى جميع القنوات المطلوبة.");
    }
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('✅ Bot is running...');
}).catch(err => {
    console.error('❌ Error starting bot:', err);
});

// إعدادات إيقاف البوت بشكل أنيق
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));