const { Telegraf, Markup, session } = require('telegraf');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// تهيئة Express
const app = express();
const PORT = process.env.PORT || 3000;

// بيانات البوت
const TOKEN = "8018964869:AAHevMgPMsip0CKx4-virvESUiNdcRRcKz8";
const ADMIN_ID = 6808883615;
const DEVELOPER_USERNAME = "@QR_l4";

// ملفات التخزين
const DATA_FILE = "bot_data.json";
const CHANNELS_FILE = "channels_data.json";

// عدد الأعمدة المطلوبة للأزرار
let COLUMNS = 2;

// API إنشاء الصور بالذكاء الاصطناعي
const AI_API_URL = 'https://ai-api.magicstudio.com/api/ai-art-generator';

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
    return { buttons: [], services_order: ["translation", "visa", "image", "tiktok"] };
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
            console.error(`Error checking subscription for channel ${channel.id}:`, error);
            // إذا كان البوت ليس أدمن في القناة، نعتبر أن المستخدم مشترك
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
        
        await ctx.reply(
            "⚠️ يجب عليك الانضمام إلى القنوات التالية لاستخدام البوت:",
            Markup.inlineKeyboard(keyboard)
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
    const oddDigits = digits.slice().reverse().filter((_, i) => i % 2 === 0);
    const evenDigits = digits.slice().reverse().filter((_, i) => i % 2 === 1);
    
    let checksum = oddDigits.reduce((sum, digit) => sum + digit, 0);
    
    for (const d of evenDigits) {
        const doubled = digitsOf(d * 2);
        checksum += doubled.reduce((sum, digit) => sum + digit, 0);
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
    const cardNumber = baseNumber + String(checksumDigit);
    
    return cardNumber;
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
        console.error("Translation error:", error);
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
        
        const data = new URLSearchParams({
            'prompt': prompt,
            'output_format': 'bytes',
            'user_profile_id': 'null',
            'user_is_subscribed': 'true'
        });
        
        const response = await axios.post(AI_API_URL, data, { 
            headers: headers,
            responseType: 'arraybuffer'
        });
        
        return response.data;
    } catch (error) {
        console.error("AI Image generation error:", error);
        throw error;
    }
}

// وظائف صيد يوزرات انستجرام
function checkInstagramUser(user) {
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
    
    return axios.post(url, data, { headers: headers, timeout: 10000 })
        .then(response => {
            const responseText = response.data;
            
            if (responseText.includes('{"message":"feedback_required","spam":true,')) {
                return false;
            } else if (responseText.includes('"errors": {"username":') || responseText.includes('"code": "username_is_taken"')) {
                return false;
            } else {
                return true;
            }
        })
        .catch(error => {
            console.error(`Error checking user ${user}:`, error);
            return false;
        });
}

function generate4charUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.3) {
            const user = Array.from({ length: 4 }, () => insta[Math.floor(Math.random() * insta.length)]).join('');
            users.push(user);
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
            const user = Array.from({ length: 5 }, () => insta[Math.floor(Math.random() * insta.length)]).join('');
            users.push(user);
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
            const user = Array.from({ length }, () => insta[Math.floor(Math.random() * insta.length)]).join('');
            users.push(user);
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
            const user = Array.from({ length: 4 }, () => insta[Math.floor(Math.random() * insta.length)]).join('');
            users.push(user);
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
            if (goodUsers.length >= 5) {
                break;
            }
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
🎯 الحالة: متاح للتسجيل

💾 اليوزر ${foundUsers} من 5`;
                
                await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
                if (foundUsers >= 5) {
                    break;
                }
            }
        }
        
        if (foundUsers >= 5) {
            break;
        }
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
        console.error("TikTok API error:", error);
        return {};
    }
}

// إنشاء لوحة المفاتيح الرئيسية مع الترتيب المطلوب
function createMainKeyboard(userId) {
    const data = loadData();
    
    const keyboard = [];
    
    // إضافة أزرار المواقع أولاً
    const buttonsList = [];
    for (const btn of data.buttons) {
        buttonsList.push(Markup.button.webApp(btn.text, btn.url));
    }
    
    // ترتيب أزرار المواقع في أعمدة
    if (buttonsList.length) {
        keyboard.push(...arrangeButtonsInColumns(buttonsList));
    }
    
    // إضافة أزرار الخدمات حسب الترتيب المحدد
    const servicesOrder = data.services_order || ["translation", "visa", "image", "tiktok"];
    const serviceButtons = [];
    
    for (const service of servicesOrder) {
        if (service === "translation") {
            serviceButtons.push(Markup.button.callback("خدمة الترجمة 🌐", "translation_service"));
        } else if (service === "visa") {
            serviceButtons.push(Markup.button.callback("توليد فيزا 💳", "generate_visa"));
        } else if (service === "image") {
            serviceButtons.push(Markup.button.callback("إنشاء صورة 🎨", "generate_image"));
        } else if (service === "tiktok") {
            serviceButtons.push(Markup.button.callback("معلومات تيك توك 📱", "tiktok_service"));
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

// التحقق من الاشتراك
bot.action("check_subscription", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك
    if (await checkSubscription(ctx, userId)) {
        await ctx.editMessageText("✅ أنت مشترك في جميع القنوات! يمكنك الآن استخدام البوت.");
        // إعادة تحميل القائمة الرئيسية بعد التأكد من الاشتراك
        await startFromCallback(ctx);
    }
});

// بدء من callback
async function startFromCallback(ctx) {
    const userId = ctx.from.id;
    const replyMarkup = createMainKeyboard(userId);
    
    await ctx.editMessageText(
        "مرحباً! هذه قائمة الخدمات المتاحة:",
        replyMarkup
    );
}

// توليد فيزا
bot.action("generate_visa", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const [cardNumber, expiry, cvv, cardHolder] = generateRealisticVisa();
    
    await ctx.replyWithMarkdownV2(
        `💳 **بطاقة فيزا محاكاة:**\n\n` +
        `**الرقم:** \`${cardNumber}\`\n` +
        `**تاريخ الانتهاء:** \`${expiry}\`\n` +
        `**CVV:** \`${cvv}\`\n` +
        `**حامل البطاقة:** \`${cardHolder}\`\n\n`
    );
});

// إنشاء صورة بالذكاء الاصطناعي
bot.action("generate_image", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.editMessageText(
        "🎨 **إنشاء صورة بالذكاء الاصطناعي**\n\n" +
        "أرسل لي وصفاً للصورة التي تريد إنشاءها.\n\n" +
        "مثال:\n" +
        "• منظر غروب الشمس على البحر\n" +
        "• قطة لطيفة تجلس في الحديقة\n" +
        "• منزل حديث في الغابة\n\n" +
        "أرسل الوصف الآن:"
    );
    
    ctx.session.awaitingImagePrompt = true;
});

// صيد يوزرات انستجرام
bot.action("instagram_hunt", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const keyboard = [
        [Markup.button.callback("🔍 يوزرات خماسية (5 أحرف)", "insta_5char")],
        [Markup.button.callback("🎯 يوزرات رباعية سهلة (4 أحرف + رمزين)", "insta_easy4char")],
        [Markup.button.callback("🔍 يوزرات خاصة (6 أحرف)", "insta_special")],
        [Markup.button.callback("العودة ↩️", "back_to_main")]
    ];
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    await ctx.editMessageText(
        "🎯 اختر نوع اليوزرات التي تريد صيدها:\n\n" +
        "• يوزرات خماسية: 5 أحرف (عشوائي مع/بدون رموز)\n" +
        "• يوزرات رباعية سهلة: 4 أحرف + رمزين (سهلة الصيد)\n" +
        "• يوزرات خاصة: 6 أحرف (عشوائي مع/بدون رموز)\n\n" +
        "🔍 البوت سيبحث حتى يعثر على 5 يوزرات متاحة",
        replyMarkup
    );
});

// معالجة صيد اليوزرات
bot.action(/^insta_/, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const huntType = ctx.match[0].split('_')[1];
    
    if (user_sessions[userId]) {
        await ctx.editMessageText("⚠️ هناك عملية صيد جارية بالفعل!");
        return;
    }
    
    await ctx.editMessageText("🎯 بدأ الصيد! جاري البحث عن يوزرات متاحة...");
    
    // بدء عملية الصيد في الخلفية
    instagramCheckProcess(userId, ctx.telegram, huntType)
        .catch(error => {
            console.error("Error in instagram hunt:", error);
            ctx.telegram.sendMessage(userId, "❌ حدث خطأ أثناء عملية الصيد. يرجى المحاولة مرة أخرى.");
        });
});

// خدمة الترجمة
bot.action("translation_service", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    // إنشاء لوحة اختيار اللغة المصدر
    const keyboard = [];
    const langList = Object.keys(SUPPORTED_LANGUAGES);
    
    for (let i = 0; i < langList.length; i += 2) {
        const row = [];
        if (i < langList.length) {
            row.push(Markup.button.callback(langList[i], `src_lang_${SUPPORTED_LANGUAGES[langList[i]]}`));
        }
        if (i + 1 < langList.length) {
            row.push(Markup.button.callback(langList[i + 1], `src_lang_${SUPPORTED_LANGUAGES[langList[i + 1]]}`));
        }
        keyboard.push(row);
    }
    
    keyboard.push([Markup.button.callback("إلغاء ❌", "back_to_main")]);
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    await ctx.editMessageText(
        "اختر اللغة المصدر للنص الذي تريد ترجمته:",
        replyMarkup
    );
});

// اختيار اللغة المصدر
bot.action(/^src_lang_/, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const langCode = ctx.match[0].split('_')[2];
    ctx.session.translationSource = langCode;
    
    // إنشاء لوحة اختيار اللغة الهدف
    const keyboard = [];
    const langList = Object.keys(SUPPORTED_LANGUAGES);
    
    for (let i = 0; i < langList.length; i += 2) {
        const row = [];
        if (i < langList.length) {
            row.push(Markup.button.callback(langList[i], `tgt_lang_${SUPPORTED_LANGUAGES[langList[i]]}`));
        }
        if (i + 1 < langList.length) {
            row.push(Markup.button.callback(langList[i + 1], `tgt_lang_${SUPPORTED_LANGUAGES[langList[i + 1]]}`));
        }
        keyboard.push(row);
    }
    
    keyboard.push([Markup.button.callback("إلغاء ❌", "back_to_main")]);
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    // الحصول على اسم اللغة المصدر
    const srcLangName = Object.keys(SUPPORTED_LANGUAGES).find(
        name => SUPPORTED_LANGUAGES[name] === langCode
    );
    
    await ctx.editMessageText(
        `اختر اللغة الهدف للترجمة (من ${srcLangName}):`,
        replyMarkup
    );
});

// اختيار اللغة الهدف
bot.action(/^tgt_lang_/, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    const langCode = ctx.match[0].split('_')[2];
    ctx.session.translationTarget = langCode;
    
    // الحصول على اسمي اللغتين
    const srcLangName = Object.keys(SUPPORTED_LANGUAGES).find(
        name => SUPPORTED_LANGUAGES[name] === ctx.session.translationSource
    );
    const tgtLangName = Object.keys(SUPPORTED_LANGUAGES).find(
        name => SUPPORTED_LANGUAGES[name] === langCode
    );
    
    await ctx.editMessageText(
        `🌐 **إعدادات الترجمة**\n\n` +
        `من: ${srcLangName}\n` +
        `إلى: ${tgtLangName}\n\n` +
        `أرسل النص الذي تريد ترجمته الآن:`,
        { parse_mode: 'Markdown' }
    );
    
    ctx.session.awaitingTranslation = true;
});

// خدمة تيك توك
bot.action("tiktok_service", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    await ctx.editMessageText(
        "📱 **خدمة معلومات تيك توك**\n\n" +
        "أرسل لي اسم المستخدم (بدون @) للحساب الذي تريد معلومات عنه.\n\n" +
        "مثال:\n" +
        "• khaby00\n" +
        "• addisonre\n" +
        "• bellapoarch\n\n" +
        "أرسل اسم المستخدم الآن:"
    );
    
    ctx.session.awaitingTikTokUsername = true;
});

// لوحة إدارة المشرف
bot.action("admin_panel", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    const keyboard = [
        [Markup.button.callback("إضافة زر موقع 🌐", "add_web_button")],
        [Markup.button.callback("حذف زر موقع 🗑️", "delete_web_button")],
        [Markup.button.callback("إضافة قناة اشتراك 📢", "add_channel")],
        [Markup.button.callback("حذف قناة اشتراك 🗑️", "delete_channel")],
        [Markup.button.callback("تغيير ترتيب الخدمات 🔄", "change_services_order")],
        [Markup.button.callback("العودة ↩️", "back_to_main")]
    ];
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    await ctx.editMessageText(
        "⚙️ **لوحة إدارة المشرف**\n\n" +
        "اختر الإجراء الذي تريد تنفيذه:",
        replyMarkup
    );
});

// إضافة زر موقع
bot.action("add_web_button", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    await ctx.editMessageText(
        "🌐 **إضافة زر موقع جديد**\n\n" +
        "أرسل النص والرابط بالتنسيق التالي:\n" +
        "`النص - الرابط`\n\n" +
        "مثال:\n" +
        "`جوجل - https://google.com`\n\n" +
        "أرسل التنسيق الآن:"
    );
    
    ctx.session.awaitingWebButton = true;
});

// حذف زر موقع
bot.action("delete_web_button", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    const data = loadData();
    
    if (!data.buttons || data.buttons.length === 0) {
        await ctx.editMessageText("❌ لا توجد أزرار مواقع لحذفها.");
        return;
    }
    
    const keyboard = data.buttons.map((btn, index) => [
        Markup.button.callback(`${btn.text}`, `delete_btn_${index}`)
    ]);
    
    keyboard.push([Markup.button.callback("إلغاء ❌", "admin_panel")]);
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    await ctx.editMessageText(
        "🗑️ **حذف زر موقع**\n\n" +
        "اختر الزر الذي تريد حذفه:",
        replyMarkup
    );
});

// حذف زر معين
bot.action(/^delete_btn_/, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    const index = parseInt(ctx.match[0].split('_')[2]);
    const data = loadData();
    
    if (index >= 0 && index < data.buttons.length) {
        const deletedButton = data.buttons.splice(index, 1)[0];
        saveData(data);
        
        await ctx.editMessageText(
            `✅ تم حذف الزر بنجاح:\n` +
            `النص: ${deletedButton.text}\n` +
            `الرابط: ${deletedButton.url}`
        );
    } else {
        await ctx.editMessageText("❌ فشل حذف الزر. الفهرس غير صحيح.");
    }
});

// إضافة قناة اشتراك
bot.action("add_channel", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    await ctx.editMessageText(
        "📢 **إضافة قناة اشتراك إجباري**\n\n" +
        "أرسل معرف القناة أو الرابط بالشكل التالي:\n" +
        "`@username` أو `https://t.me/username`\n\n" +
        "ملاحظة: يجب أن يكون البوت مشرفاً في القناة.\n\n" +
        "أرسل معرف القناة الآن:"
    );
    
    ctx.session.awaitingChannel = true;
});

// حذف قناة اشتراك
bot.action("delete_channel", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    const channelsData = loadChannels();
    
    if (!channelsData.channels || channelsData.channels.length === 0) {
        await ctx.editMessageText("❌ لا توجد قنوات اشتراك لحذفها.");
        return;
    }
    
    const keyboard = channelsData.channels.map((channel, index) => [
        Markup.button.callback(`${channel.name}`, `delete_ch_${index}`)
    ]);
    
    keyboard.push([Markup.button.callback("إلغاء ❌", "admin_panel")]);
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    await ctx.editMessageText(
        "🗑️ **حذف قناة اشتراك**\n\n" +
        "اختر القناة التي تريد حذفها:",
        replyMarkup
    );
});

// حذف قناة معينة
bot.action(/^delete_ch_/, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    const index = parseInt(ctx.match[0].split('_')[2]);
    const channelsData = loadChannels();
    
    if (index >= 0 && index < channelsData.channels.length) {
        const deletedChannel = channelsData.channels.splice(index, 1)[0];
        saveChannels(channelsData);
        
        await ctx.editMessageText(
            `✅ تم حذف القناة بنجاح:\n` +
            `الاسم: ${deletedChannel.name}\n` +
            `المعرف: ${deletedChannel.id}`
        );
    } else {
        await ctx.editMessageText("❌ فشل حذف القناة. الفهرس غير صحيح.");
    }
});

// تغيير ترتيب الخدمات
bot.action("change_services_order", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        await ctx.reply("❌ ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        return;
    }
    
    const data = loadData();
    const currentOrder = data.services_order || ["translation", "visa", "image", "tiktok"];
    
    const serviceNames = {
        "translation": "خدمة الترجمة 🌐",
        "visa": "توليد فيزا 💳",
        "image": "إنشاء صورة 🎨",
        "tiktok": "معلومات تيك توك 📱"
    };
    
    const keyboard = [
        [Markup.button.callback("⬆️ رفع", "move_up"), Markup.button.callback("⬇️ خفض", "move_down")],
        [Markup.button.callback("✅ حفظ", "save_order"), Markup.button.callback("❌ إلغاء", "admin_panel")]
    ];
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    let orderText = "🔀 **ترتيب الخدمات الحالي:**\n\n";
    currentOrder.forEach((service, index) => {
        orderText += `${index + 1}. ${serviceNames[service]}\n`;
    });
    
    orderText += "\nاستخدم الأزرار لترتيب الخدمات:";
    
    await ctx.editMessageText(orderText, replyMarkup);
    
    ctx.session.servicesOrder = [...currentOrder];
    ctx.session.currentOrderIndex = 0;
});

// تحريك الخدمة لأعلى
bot.action("move_up", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        return;
    }
    
    const currentIndex = ctx.session.currentOrderIndex;
    const services = ctx.session.servicesOrder;
    
    if (currentIndex > 0) {
        // تبديل المواقع
        [services[currentIndex], services[currentIndex - 1]] = [services[currentIndex - 1], services[currentIndex]];
        ctx.session.currentOrderIndex = currentIndex - 1;
    }
    
    await updateServicesOrderMessage(ctx);
});

// تحريك الخدمة لأسفل
bot.action("move_down", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        return;
    }
    
    const currentIndex = ctx.session.currentOrderIndex;
    const services = ctx.session.servicesOrder;
    
    if (currentIndex < services.length - 1) {
        // تبديل المواقع
        [services[currentIndex], services[currentIndex + 1]] = [services[currentIndex + 1], services[currentIndex]];
        ctx.session.currentOrderIndex = currentIndex + 1;
    }
    
    await updateServicesOrderMessage(ctx);
});

// حفظ ترتيب الخدمات
bot.action("save_order", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // التحقق من صلاحية المشرف
    if (!isAdmin(userId)) {
        return;
    }
    
    const data = loadData();
    data.services_order = ctx.session.servicesOrder;
    saveData(data);
    
    await ctx.editMessageText("✅ تم حفظ ترتيب الخدمات بنجاح!");
});

// تحديث رسالة ترتيب الخدمات
async function updateServicesOrderMessage(ctx) {
    const serviceNames = {
        "translation": "خدمة الترجمة 🌐",
        "visa": "توليد فيزا 💳",
        "image": "إنشاء صورة 🎨",
        "tiktok": "معلومات تيك توك 📱"
    };
    
    const services = ctx.session.servicesOrder;
    const currentIndex = ctx.session.currentOrderIndex;
    
    const keyboard = [
        [Markup.button.callback("⬆️ رفع", "move_up"), Markup.button.callback("⬇️ خفض", "move_down")],
        [Markup.button.callback("✅ حفظ", "save_order"), Markup.button.callback("❌ إلغاء", "admin_panel")]
    ];
    
    const replyMarkup = Markup.inlineKeyboard(keyboard);
    
    let orderText = "🔀 **ترتيب الخدمات الحالي:**\n\n";
    services.forEach((service, index) => {
        if (index === currentIndex) {
            orderText += `👉 ${index + 1}. ${serviceNames[service]}\n`;
        } else {
            orderText += `${index + 1}. ${serviceNames[service]}\n`;
        }
    });
    
    orderText += "\nاستخدم الأزرار لترتيب الخدمات:";
    
    await ctx.editMessageText(orderText, replyMarkup);
}

// العودة للقائمة الرئيسية
bot.action("back_to_main", async (ctx) => {
    await ctx.answerCbQuery();
    await startFromCallback(ctx);
});

// معالجة الرسائل النصية
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const messageText = ctx.message.text;
    
    // التحقق من الاشتراك أولاً
    if (!await checkSubscription(ctx, userId)) {
        return;
    }
    
    // إذا كان المستخدم ينتج وصف صورة
    if (ctx.session.awaitingImagePrompt) {
        ctx.session.awaitingImagePrompt = false;
        
        await ctx.reply("⏳ جاري إنشاء الصورة...");
        
        try {
            // ترجمة النص إلى الإنجليزية إذا لزم الأمر
            const englishPrompt = await translateToEnglish(messageText);
            
            // إنشاء الصورة
            const imageBuffer = await createAiImage(englishPrompt);
            
            // إرسال الصورة
            await ctx.replyWithPhoto(
                { source: imageBuffer },
                { caption: `🎨 الصورة الناتجة عن الوصف:\n"${messageText}"` }
            );
        } catch (error) {
            console.error("Error creating AI image:", error);
            await ctx.reply("❌ حدث خطأ أثناء إنشاء الصورة. يرجى المحاولة مرة أخرى.");
        }
        
        return;
    }
    
    // إذا كان المستخدم ينتظر ترجمة نص
    if (ctx.session.awaitingTranslation) {
        ctx.session.awaitingTranslation = false;
        
        await ctx.reply("⏳ جاري الترجمة...");
        
        try {
            const sourceLang = ctx.session.translationSource;
            const targetLang = ctx.session.translationTarget;
            
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(messageText)}`;
            const response = await axios.get(translateUrl);
            
            const translatedText = response.data[0][0][0];
            
            // الحصول على اسمي اللغتين
            const srcLangName = Object.keys(SUPPORTED_LANGUAGES).find(
                name => SUPPORTED_LANGUAGES[name] === sourceLang
            );
            const tgtLangName = Object.keys(SUPPORTED_LANGUAGES).find(
                name => SUPPORTED_LANGUAGES[name] === targetLang
            );
            
            await ctx.reply(
                `🌐 **الترجمة**\n\n` +
                `**من ${srcLangName}:**\n${messageText}\n\n` +
                `**إلى ${tgtLangName}:**\n${translatedText}`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error("Translation error:", error);
            await ctx.reply("❌ حدث خطأ أثناء الترجمة. يرجى المحاولة مرة أخرى.");
        }
        
        return;
    }
    
    // إذا كان المستخدم ينتظر اسم مستخدم تيك توك
    if (ctx.session.awaitingTikTokUsername) {
        ctx.session.awaitingTikTokUsername = false;
        
        const username = messageText.trim();
        
        if (!username) {
            await ctx.reply("❌ يرجى إرسال اسم مستخدم صحيح.");
            return;
        }
        
        await ctx.reply("⏳ جاري جلب معلومات الحساب...");
        
        try {
            const userInfo = await getTikTokInfo(username);
            
            if (!userInfo || !userInfo.user) {
                await ctx.reply("❌ لم يتم العثور على معلومات لهذا الحساب.");
                return;
            }
            
            const user = userInfo.user;
            const stats = userInfo.stats || {};
            
            let infoText = `📱 **معلومات حساب تيك توك**\n\n`;
            infoText += `👤 **اسم المستخدم:** ${user.uniqueId || 'غير متوفر'}\n`;
            infoText += `📛 **الاسم:** ${user.nickname || 'غير متوفر'}\n`;
            infoText += `📝 **البايو:** ${user.signature || 'غير متوفر'}\n\n`;
            
            infoText += `📊 **الإحصائيات:**\n`;
            infoText += `👀 **المتابعون:** ${stats.followerCount || 0}\n`;
            infoText += `❤️ **الإعجابات:** ${stats.heartCount || 0}\n`;
            infoText += `📹 **عدد الفيديوهات:** ${stats.videoCount || 0}\n\n`;
            
            if (user.avatarLarger) {
                await ctx.replyWithPhoto(user.avatarLarger, { caption: infoText, parse_mode: 'Markdown' });
            } else {
                await ctx.reply(infoText, { parse_mode: 'Markdown' });
            }
        } catch (error) {
            console.error("TikTok info error:", error);
            await ctx.reply("❌ حدث خطأ أثناء جلب معلومات الحساب. يرجى المحاولة مرة أخرى.");
        }
        
        return;
    }
    
    // إذا كان المشرف يضيف زر موقع
    if (ctx.session.awaitingWebButton && isAdmin(userId)) {
        ctx.session.awaitingWebButton = false;
        
        const parts = messageText.split(' - ');
        if (parts.length < 2) {
            await ctx.reply("❌ التنسيق غير صحيح. يرجى استخدام: `النص - الرابط`");
            return;
        }
        
        const text = parts[0].trim();
        let url = parts.slice(1).join(' - ').trim();
        
        // التأكد من أن الرابط يبدأ بـ https://
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        const data = loadData();
        if (!data.buttons) {
            data.buttons = [];
        }
        
        data.buttons.push({ text, url });
        saveData(data);
        
        await ctx.reply(`✅ تم إضافة الزر بنجاح:\nالنص: ${text}\nالرابط: ${url}`);
        return;
    }
    
    // إذا كان المشرف يضيف قناة اشتراك
    if (ctx.session.awaitingChannel && isAdmin(userId)) {
        ctx.session.awaitingChannel = false;
        
        let channelId = messageText.trim();
        let channelName = "قناة";
        
        // استخراج معرف القناة من الرابط إذا كان رابطاً
        if (channelId.includes('t.me/')) {
            const match = channelId.match(/t\.me\/(.+)/);
            if (match && match[1]) {
                channelId = match[1].startsWith('@') ? match[1] : `@${match[1]}`;
            }
        }
        
        // إذا كان المعرف لا يبدأ بـ @، نضيفها
        if (!channelId.startsWith('@') && !channelId.startsWith('-100')) {
            channelId = `@${channelId}`;
        }
        
        // محاولة الحصول على معلومات القناة
        try {
            const chat = await ctx.telegram.getChat(channelId);
            channelName = chat.title || "قناة";
            channelId = chat.id;
        } catch (error) {
            console.error("Error getting channel info:", error);
            // إذا فشلنا في الحصول على معلومات القناة، نستخدم المعرف كما هو
        }
        
        const channelsData = loadChannels();
        if (!channelsData.channels) {
            channelsData.channels = [];
        }
        
        // التحقق من عدم إضافة القناة مسبقاً
        if (channelsData.channels.some(ch => ch.id === channelId)) {
            await ctx.reply("❌ هذه القناة مضافه مسبقاً.");
            return;
        }
        
        channelsData.channels.push({
            id: channelId,
            name: channelName,
            username: channelId.startsWith('@') ? channelId.substring(1) : undefined
        });
        
        saveChannels(channelsData);
        
        await ctx.reply(`✅ تم إضافة القناة بنجاح:\nالاسم: ${channelName}\nالمعرف: ${channelId}`);
        return;
    }
    
    // إذا لم تكن الرسالة ضمن أي من السياقات أعلاه، نعيد القائمة الرئيسية
    const replyMarkup = createMainKeyboard(userId);
    await ctx.reply(
        "مرحباً! هذه قائمة الخدمات المتاحة:",
        replyMarkup
    );
});

// معالجة الأخطاء
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
});

// بدء تشغيل البوت
bot.launch().then(() => {
    console.log('Bot is running...');
}).catch(err => {
    console.error('Error starting bot:', err);
});

// إعداد خادم Express كخادم وسيط
app.use(express.json());

// نقطة نهاية للتحقق من حالة البوت
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running', timestamp: new Date().toISOString() });
});

// نقطة نهاية للتحقق من حالة البوت
app.get('/health', (req, res) => {
    res.json({ status: 'OK', bot: 'running', timestamp: new Date().toISOString() });
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Express server is running on port ${PORT}`);
});

// تمكين إيقاف البوت بشكل أنيق
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
});