/**
 * 初始化 Mock 数据（可重复运行：先清空再插入）
 *   - 1 个管理员账号 admin/admin123（仅当不存在时创建）
 *   - 12 款陶瓷产品
 *   - 8 个工程案例（迪拜真实客户）
 * 运行：
 *   cd backend && npm run seed
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import Admin from '../models/Admin';
import Product from '../models/Product';
import CaseModel from '../models/Case';
import Inquiry from '../models/Inquiry';
import Order from '../models/Order';
import { env } from '../config/env';

// 所有产品/案例图片使用前端 public/images/ 下的真实陶瓷产品图（已 AI 生成）
// 13 张固定图：3 hero × 2 about × 6 category × 2 轮播共用 → 实际 11 张文件
// 我们给 12 个产品各配主图 + 多图（detailImages）和详情细节图
const IMGS = {
  heroTableware: '/images/hero-tableware-gold.jpg',
  heroVase: '/images/hero-vase-artisan.jpg',
  heroPlatter: '/images/hero-middle-east-platter.jpg',
  aboutHand: '/images/about-artisan-handmade.jpg',
  aboutGlaze: '/images/about-glaze-color.jpg',
  catTableware: '/images/cat-tableware.jpg',
  catVase: '/images/cat-vase.jpg',
  catSculpture: '/images/cat-sculpture.jpg',
  catHotel: '/images/cat-hotelware.jpg',
  catTiles: '/images/cat-tiles.jpg',
  catOem: '/images/cat-oem.jpg',
};

const products = [
  // 1~2 餐桌瓷
  {
    sku: 'LUX-TW-001', nameEn: '24K Gold-Rim Bone China Dinner Set (4 pax)',
    nameAr: 'طقم عشاء بورسلين عظمي بماء ذهب عيار 24 (4 أشخاص)',
    descEn: 'Elegant bone china dinner set with hand-painted 24K matte gold rim. 20 pieces including plates, bowls and cups.',
    descAr: 'طقم عشاء فخم من بورسلين عظمي بزينة ذهبية مات مقاومة للخدش، 20 قطعة تشمل الأطباق والأوعية والأكواب.',
    category: 'tableware' as const, material: 'bone-china' as const, glazeColor: 'Matte Gold / Milk White',
    size: 'Plate Ø26cm, Bowl Ø12cm',
    images: [IMGS.heroTableware, IMGS.catTableware, IMGS.aboutGlaze],
    detailImages: [IMGS.catTableware, IMGS.aboutGlaze],
    isCustom: true, isStock: true, moq: 10, priceMin: 380, priceMax: 580,
    oemOptions: ['logo', 'shape', 'glaze', 'packaging'] as const,
    careEn: 'Hand wash only. Not microwave safe due to gold decoration.',
    careAr: 'للغسل اليدوي فقط. غير مناسب للميكروويف بسبب الزينة الذهبية.',
    shippingNoteEn: 'Wooden-crated, foam-lined. Ships worldwide with fragile insurance.',
    shippingNoteAr: 'تغليف في صناديق خشبية مبطنة برغوة. الشحن العالمي مع تأمين ضد الكسر.',
    featured: true, sortOrder: 1,
  },
  {
    sku: 'LUX-TW-002', nameEn: 'Hand-Painted Blue & White Porcelain Bowl (Ø22cm)',
    nameAr: 'طبق بورسلين أبيض وأزرق مرسوم يدوياً (قطر 22 سم)',
    descEn: 'Classic blue-and-white cobalt pattern, hand-painted by Jingdezhen master artists. 1280°C high-fired.',
    descAr: 'نمط أزرق وأبيض كلاسيكي مرسوم يدوياً بواسطة حرفيين خبراء. محروق بحرارة 1280 درجة.',
    category: 'tableware' as const, material: 'porcelain' as const, glazeColor: 'Cobalt Blue on White',
    size: 'Ø22cm × H7.5cm',
    images: [IMGS.heroPlatter, IMGS.heroTableware, IMGS.catTableware],
    detailImages: [IMGS.aboutGlaze],
    isCustom: true, isStock: true, moq: 20, priceMin: 45, priceMax: 78,
    oemOptions: ['logo', 'glaze', 'size'] as const,
    careEn: 'Dishwasher safe on porcelain mode, hand-wash recommended for longevity.',
    careAr: 'غسالة صحنية مقبولة على الوضع اللطيف، غسل يدوي مفضل.',
    shippingNoteEn: 'Double-wrapped honeycomb + foam. 6 pcs per outer carton.',
    shippingNoteAr: 'تغليف مزدوج بورق خليوي ورغوة. 6 قطع لكل كرتون.',
    featured: true, sortOrder: 2,
  },
  // 3~4 花瓶
  {
    sku: 'LUX-VA-003', nameEn: 'Matte Gold Glazed Ceramic Vase (Ø40cm × H55cm)',
    nameAr: 'مزهرية سيراميك بطلاء ذهبي مات (قطر 40 × ارتفاع 55 سم)',
    descEn: 'Signature matte gold glaze, hand-sprayed in 4 layers. Statement piece for hotel lobbies.',
    descAr: 'طلاء ذهبي مات حصري مطبوع في 4 طبقات يدوياً. قطعة مركزية لفنادق وقصور.',
    category: 'vase' as const, material: 'ceramic' as const, glazeColor: 'Matte Gold',
    size: 'Ø40cm × H55cm',
    images: [IMGS.catVase, IMGS.heroVase, IMGS.heroTableware],
    detailImages: [IMGS.aboutGlaze, IMGS.catVase],
    isCustom: true, isStock: false, moq: 5, priceMin: 890, priceMax: 1480,
    oemOptions: ['shape', 'glaze', 'size', 'packaging'] as const,
    careEn: 'Wipe with dry soft cloth. Avoid abrasive cleaners.', careAr: 'يمسح بقطعة قماش ناعمة.',
    shippingNoteEn: 'Custom wooden crate per piece. 100% fragile insured.',
    shippingNoteAr: 'صندوق خشبي مخصص لكل قطعة مع تأمين كامل.',
    featured: true, sortOrder: 3,
  },
  {
    sku: 'LUX-VA-004', nameEn: 'Drip-Glaze Large Ceramic Vase (120cm)',
    nameAr: 'مزهرية سيراميك كبيرة بطلاء متناثر (120 سم)',
    descEn: 'One-of-a-kind natural ash drip-glaze flow, each piece is unique with its own glaze pattern.',
    descAr: 'طلاء متناثر طبيعي فريد، كل قطعة تمتلك نمطاً مختلفاً لا يتكرر.',
    category: 'vase' as const, material: 'stoneware' as const, glazeColor: 'Natural Ash Flow (Celadon → Deep Brown)',
    size: 'Ø46cm × H120cm',
    images: [IMGS.heroVase, IMGS.catVase, IMGS.aboutGlaze],
    detailImages: [IMGS.aboutGlaze],
    isCustom: false, isStock: true, moq: 2, priceMin: 2180, priceMax: 3600,
    oemOptions: ['glaze', 'size'] as const,
    careEn: 'Indoor decorative use only.', careAr: 'للاستخدام الديكوري الداخلي فقط.',
    shippingNoteEn: 'Plywood crate + foam matrix. Requires 2-man lift.',
    shippingNoteAr: 'صندوق خشبي مضغوط + إطار رغوة. يتطلب رفع من شخصين.',
    featured: false, sortOrder: 4,
  },
  // 5~6 艺术雕塑
  {
    sku: 'LUX-SC-005', nameEn: 'Hand-Formed Swan Art Sculpture (H62cm, White Gold)',
    nameAr: 'منحوتة فن على شكل سوين مركبة يدوياً (62 سم، ذهبي أبيض)',
    descEn: 'Hand-built stoneware sculpture. No two are exactly the same — every feather is pinched by hand.',
    descAr: 'منحوتة مصنوعة يدوياً بطريقة السباجيتي. كل ريشة منحوتة يدوياً بشكل فريد.',
    category: 'art-sculpture' as const, material: 'stoneware' as const, glazeColor: 'Pearl White × 24K Gold Accent',
    size: 'L50 × W28 × H62cm',
    images: [IMGS.catSculpture, IMGS.heroVase, IMGS.aboutHand],
    detailImages: [IMGS.aboutHand],
    isCustom: true, isStock: false, moq: 1, priceMin: 1680, priceMax: 2480,
    oemOptions: ['shape', 'glaze', 'size'] as const,
    careEn: 'Dust with soft brush, do not wash.',
    careAr: 'ينظف بفرشاة ناعمة، لا يغسل.',
    shippingNoteEn: 'Individual flight-case style wooden box.',
    shippingNoteAr: 'صندوق خشبي أسلوب حالبات الطيران.',
    featured: true, sortOrder: 5,
  },
  {
    sku: 'LUX-SC-006', nameEn: 'Celadon Lotus Flower Sculpture (Ø50cm)',
    nameAr: 'منحوتة زهرة اللوتس بلون السيليدون (قطر 50 سم)',
    descEn: 'A sculptural 888-petal celadon lotus — auspicious symbol for Middle Eastern luxury interiors.',
    descAr: 'زهرة لوتس منحوتة من 888 بتلة بلون السيليدون الفاخر. رمز للحظ السعيد.',
    category: 'art-sculpture' as const, material: 'porcelain' as const, glazeColor: 'Ice Celadon',
    size: 'Ø50cm × H24cm',
    images: [IMGS.catSculpture, IMGS.aboutGlaze, IMGS.catVase],
    detailImages: [IMGS.aboutGlaze],
    isCustom: true, isStock: true, moq: 1, priceMin: 980, priceMax: 1580,
    oemOptions: ['shape', 'glaze', 'size', 'packaging'] as const,
    careEn: 'Soft dry brush only.', careAr: 'فرشاة ناعمة وجافة فقط.',
    shippingNoteEn: 'Premium silk-lined wooden box.',
    shippingNoteAr: 'صندوق خشبي مبطن بالحرير.',
    featured: false, sortOrder: 6,
  },
  // 7~8 酒店瓷
  {
    sku: 'LUX-HW-007', nameEn: 'Presidential Suite 68-Piece Dinnerware Set',
    nameAr: 'طقم مائدة 68 قطعة للأجنحة الرئاسية',
    descEn: 'Designed for presidential suites of 5-star hotels. Each piece underglaze stamped with hotel crest.',
    descAr: 'مصمم خصيصاً للأجنحة الرئاسية بالفنادق الخمس نجوم. ختم شعار الفندق تحت الطلاء.',
    category: 'hotel-ware' as const, material: 'bone-china' as const, glazeColor: 'Cream White + Customizable Gold Lines',
    size: '68 pieces per set (service for 8)',
    images: [IMGS.catHotel, IMGS.heroTableware, IMGS.catTableware],
    detailImages: [IMGS.catTableware],
    isCustom: true, isStock: false, moq: 20, priceMin: 2380, priceMax: 3800,
    oemOptions: ['logo', 'shape', 'glaze', 'packaging', 'size'] as const,
    careEn: 'Commercial-grade dishwasher safe (Hobart line tested).',
    careAr: 'يتوافق مع غسالات الصحنية التجارية (تم الاختبار على خط Hobart).',
    shippingNoteEn: 'Bulk export pallets with moisture desiccants.',
    shippingNoteAr: 'منصات شحن كبيرة مع مواد ماصة للرطوبة.',
    featured: true, sortOrder: 7,
  },
  {
    sku: 'LUX-HW-008', nameEn: '5-Star Hotel Buffet Porcelain Collection',
    nameAr: 'مجموعة بورسلين البوفيه للفنادق الخمس نجوم',
    descEn: 'Heavy-duty, chip-resistant hospitality porcelain. 36-piece buffet display set.',
    descAr: 'بورسلين صناعي مقاوم للتقشير. مجموعة عرض بوفيه مكونة من 36 قطعة.',
    category: 'hotel-ware' as const, material: 'porcelain' as const, glazeColor: 'Pure White (Commercial)',
    size: 'Assorted rectangular and round platter sizes',
    images: [IMGS.catHotel, IMGS.catTableware, IMGS.aboutGlaze],
    detailImages: [],
    isCustom: true, isStock: true, moq: 50, priceMin: 1180, priceMax: 2100,
    oemOptions: ['logo', 'size', 'shape', 'glaze'] as const,
    careEn: 'Commercial dishwasher, oven and warmer compatible.',
    careAr: 'متوافق مع الغسالات التجارية والأفران والدفافات.',
    shippingNoteEn: 'Containerized 20/40ft sea export packaging.',
    shippingNoteAr: 'تغليف تصدير بحري لحاويات 20 و 40 قدماً.',
    featured: false, sortOrder: 8,
  },
  // 9~10 瓷砖
  {
    sku: 'LUX-TL-009', nameEn: 'Soft Cream Ceramic Wall Tile 300×600',
    nameAr: 'بلاط سيراميك جدران كريمي ناعم 300 × 600',
    descEn: 'Rectified-edge soft cream wall tile. Subtle hand-glaze variation gives a unique artisanal look.',
    descAr: 'بلاط حواف مصححة بلون كريمي ناعم. اختلاف طفيف في الطلاء اليدوي يعطي لمسة حرفية.',
    category: 'tiles' as const, material: 'ceramic' as const, glazeColor: 'Soft Cream Matte',
    size: '300 × 600 × 10mm',
    images: [IMGS.catTiles, IMGS.aboutGlaze, IMGS.catHotel],
    detailImages: [IMGS.catTiles],
    isCustom: true, isStock: true, moq: 200, priceMin: 18, priceMax: 32,
    oemOptions: ['size', 'glaze', 'shape'] as const,
    careEn: 'Standard tile grout cleaning with neutral pH cleaners.',
    careAr: 'التنظيف باستخدام مواد ذات أس هيدروجيني متعادل.',
    shippingNoteEn: 'Export wooden pallets, 1.44 m² per box, 15 kg per box.',
    shippingNoteAr: 'منصات خشبية للتصدير، 1.44 متر مربع لكل صندوق، 15 كجم.',
    featured: false, sortOrder: 9,
  },
  {
    sku: 'LUX-TL-010', nameEn: 'Matte Gold Lines Decorative Floor Tile (600×600)',
    nameAr: 'بلاط أرضي زخرفي بخطوط ذهبية مات (600 × 600)',
    descEn: 'Luxury decorative feature tile with inlaid matte gold pattern. Suitable for villa lobby flooring.',
    descAr: 'بلاط فخم مزخرف بنقوش ذهبية مات. مثالي لمداخل الفنادق والقصور.',
    category: 'tiles' as const, material: 'ceramic' as const, glazeColor: 'Greige × Matte Gold Inlay',
    size: '600 × 600 × 10.5mm',
    images: [IMGS.catTiles, IMGS.catHotel, IMGS.heroVase],
    detailImages: [IMGS.catTiles],
    isCustom: true, isStock: false, moq: 100, priceMin: 48, priceMax: 85,
    oemOptions: ['shape', 'glaze', 'size'] as const,
    careEn: 'Acid-free cleaner recommended.',
    careAr: 'يوصى باستخدام منظفات خالية من الأحماض.',
    shippingNoteEn: 'Wooden pallets. 1.44m² / box.',
    shippingNoteAr: 'منصات خشبية، 1.44 متر مربع لكل صندوق.',
    featured: true, sortOrder: 10,
  },
  // 11~12 OEM 样品
  {
    sku: 'LUX-OM-011', nameEn: 'Sapphire Blue 24K Gold Teapot (OEM Sample)',
    nameAr: 'إبريق شاي أزرق ياقوتي بزينة ذهبية عيار 24 (عينة OEM)',
    descEn: 'Popular OEM private-label project: custom brand crest underglaze fired. Sample shown for reference.',
    descAr: 'مشروع OEM شهير: ختم العلامة الخاصة يُحرق تحت الطلاء. العينة للمرجع فقط.',
    category: 'oem-sample' as const, material: 'porcelain' as const, glazeColor: 'Sapphire Blue + 24K Gold',
    size: '1.2L, L22 × W13 × H15cm',
    images: [IMGS.catOem, IMGS.heroPlatter, IMGS.heroTableware],
    detailImages: [IMGS.catOem],
    isCustom: true, isStock: false, moq: 100, priceMin: 78, priceMax: 140,
    oemOptions: ['logo', 'shape', 'glaze', 'packaging'] as const,
    careEn: 'Hand wash. Not microwave safe.',
    careAr: 'غسل يدوي فقط، غير مناسب للميكروويف.',
    shippingNoteEn: 'Individual gift box, 24 per outer master carton.',
    shippingNoteAr: 'صندوق هدية لكل قطعة، 24 قطعة لكل كرتون رئيسي.',
    featured: false, sortOrder: 11,
  },
  {
    sku: 'LUX-OM-012', nameEn: 'Middle Eastern Hand-Painted Decorative Platter (Ø45cm)',
    nameAr: 'طبق تزيين مرسوم يدوياً بالأسلوب الشرقي الأوسط (قطر 45 سم)',
    descEn: 'Ornamental wall platter with traditional Middle Eastern geometric pattern, handpainted.',
    descAr: 'طبق جدار زخرفي بنمط هندسي شرقي أوسط تقليدي مرسوم يدوياً.',
    category: 'oem-sample' as const, material: 'porcelain' as const, glazeColor: 'Cobalt + Matte Gold Arabesque',
    size: 'Ø45cm × H2.5cm',
    images: [IMGS.heroPlatter, IMGS.catOem, IMGS.aboutHand],
    detailImages: [IMGS.aboutHand],
    isCustom: true, isStock: true, moq: 50, priceMin: 150, priceMax: 320,
    oemOptions: ['logo', 'shape', 'glaze', 'packaging'] as const,
    careEn: 'Wipe with dry soft cloth. Do not soak.',
    careAr: 'يمسح بقطعة قماش ناعمة وجافة. لا ينقع.',
    shippingNoteEn: 'Individual gift box with foam inlay.',
    shippingNoteAr: 'صندوق هدية مع إطار رغوة لكل قطعة.',
    featured: true, sortOrder: 12,
  },
];

const cases = [
  {
    titleEn: 'Burj Al Arab Presidential Suite Tableware Upgrade',
    titleAr: 'ترقية أدوات مائدة الأجنحة الرئاسية ببرج العرب',
    clientNameEn: 'Burj Al Arab, Dubai', clientNameAr: 'برج العرب، دبي',
    locationEn: 'Jumeirah 3, Dubai, UAE', locationAr: 'جميرة 3، دبي، الإمارات',
    year: 2024, category: 'hotel' as const,
    coverImage: IMGS.catHotel,
    images: [IMGS.catHotel, IMGS.heroTableware, IMGS.catTableware],
    descEn: 'Full bespoke 68-piece service for 12 presidential suites. Hotel crest underglaze fired, 24K hand-painted gold rim. 5-week on-site trial before full rollout.',
    descAr: 'طقم مخصص 68 قطعة لـ 12 جنحة رئاسية. ختم الفندق محروق تحت الطلاء مع إطار ذهبي عيار 24 مرسوم يدوياً. تجربة ميدانية لمدة 5 أسابيع قبل التنفيذ الكامل.',
    scopeEn: '408 dinner pieces, 96 teaware, 48 custom serving pieces.',
    scopeAr: '408 قطعة طعام، 96 قطعة شاي، 48 قطعة تقديم مخصصة.',
    featured: true, sortOrder: 1,
  },
  {
    titleEn: 'Atlantis The Royal Banqueting Hall Custom Tableware',
    titleAr: 'أدوات مائدة مخصصة لقاعة الحفلات بأتلانتس ذا رويال',
    clientNameEn: 'Atlantis The Royal, Dubai', clientNameAr: 'أتلانتس ذا رويال، دبي',
    locationEn: 'Palm Jumeirah, Dubai', locationAr: 'نخلة جميرا، دبي',
    year: 2023, category: 'hotel' as const,
    coverImage: IMGS.catTableware,
    images: [IMGS.catTableware, IMGS.catHotel, IMGS.heroTableware],
    descEn: 'Developed a 1200-piece banqueting collection matching the resort\'s nautical-luxury brand identity.',
    descAr: 'تطوير مجموعة بوفيه من 1200 قطعة تتناسب مع هوية المنتجع البحرية الفاخرة.',
    scopeEn: '1200 assorted buffet and plateware pieces.',
    scopeAr: '1200 قطعة متنوعة للبوفيه وأطباق.',
    featured: true, sortOrder: 2,
  },
  {
    titleEn: 'Palm Jumeirah Private Villa Custom Ceramic Art Package',
    titleAr: 'حزمة فنون سيراميك مخصصة لفيلا خاصة نخلة جميرا',
    clientNameEn: 'Private Client, Palm Jumeirah', clientNameAr: 'عميل خاص، نخلة جميرا',
    locationEn: 'Palm Jumeirah Frond M, Dubai', locationAr: 'الواحة M، نخلة جميرا، دبي',
    year: 2024, category: 'villa' as const,
    coverImage: IMGS.catVase,
    images: [IMGS.catVase, IMGS.catSculpture, IMGS.heroVase],
    descEn: 'Curated 22 art pieces including five commissioned 1.5m matte gold vases, celadon lotus sculpture, and a custom family crest dinner set.',
    descAr: '22 قطعة فنية مختارة بما في ذلك 5 مزهرية ذهبية مات بطول 1.5 متر، منحوتة لوتس سيليدون، وطقم مائدة بشعار العائلة.',
    scopeEn: '5 vases, 12 platters, 3 sculpture, 1 private-label 88-piece dinnerware.',
    scopeAr: '5 مزهرية، 12 طبق عرض، 3 منحوتات، 1 طقم مائدة 88 قطعة بعلامة خاصة.',
    featured: true, sortOrder: 3,
  },
  {
    titleEn: 'Downtown Dubai Luxury Apartment Ceramic Installation',
    titleAr: 'تركيبات سيراميك لشقة فاخرة وسط مدينة دبي',
    clientNameEn: 'Private Developer', clientNameAr: 'مطور عقاري خاص',
    locationEn: 'Downtown Dubai, Burj Vista', locationAr: 'وسط مدينة دبي، برج فيستا',
    year: 2023, category: 'villa' as const,
    coverImage: IMGS.catTiles,
    images: [IMGS.catTiles, IMGS.aboutHand, IMGS.heroVase],
    descEn: 'Full apartment ceramic specification: feature tiles, tableware set, and 4 art vases for the show apartments.',
    descAr: 'مواصفات سيراميك كاملة للشقة: بلاط مميز، طقم مائدة، و4 مزهرية فنية للشقق المعروضة.',
    scopeEn: 'Feature wall tile, 2 dinner sets, 4 vases.',
    scopeAr: 'بلاط جدار مميز، طقم مائدة 2، 4 مزهرية.',
    featured: false, sortOrder: 4,
  },
  {
    titleEn: 'Dubai Mall Flagship Hotel Lobby Vase Installation',
    titleAr: 'تركيب مزهرية في مدخل فندق فخم بدبي مول',
    clientNameEn: 'Luxury Hotel Group', clientNameAr: 'مجموعة فنادق فاخرة',
    locationEn: 'The Dubai Mall, Downtown Dubai', locationAr: 'دبي مول، وسط مدينة دبي',
    year: 2024, category: 'commercial' as const,
    coverImage: IMGS.catVase,
    images: [IMGS.catVase, IMGS.catSculpture, IMGS.heroVase],
    descEn: 'Two 1.8-meter monumental sculptural vases with hand-applied 24K gold leaf glaze for the lobby.',
    descAr: 'مزهرية ضخمة بطول 1.8 متر بزينة ذهبية عيار 24 مطبقة يدوياً في المدخل الرئيسي.',
    scopeEn: '2 × 1.8m sculptural vases.',
    scopeAr: '2 × مزهرية منحوتة 1.8 متر.',
    featured: true, sortOrder: 5,
  },
  {
    titleEn: 'DIFC Private Club Ceramic Art Collection',
    titleAr: 'مجموعة فن سيراميك لنادي خاص في مركز دبي المالي',
    clientNameEn: 'Members Club, DIFC', clientNameAr: 'نادي للأعضاء، مركز دبي المالي العالمي',
    locationEn: 'Gate Village 8, DIFC', locationAr: 'قرية بوابة 8، مركز دبي المالي',
    year: 2023, category: 'commercial' as const,
    coverImage: IMGS.catSculpture,
    images: [IMGS.catSculpture, IMGS.catOem, IMGS.heroPlatter],
    descEn: 'Bespoke ceramic centerpieces for the cigar lounge, cigar humidors and whisky service platters.',
    descAr: 'قطع مركزية سيراميك مصممة خصيصاً لصالة السيجار وعلب ترطيب السيجار وأطباق تقديم الويسكي.',
    scopeEn: '12 centerpieces, 24 humidors, 36 service platters.',
    scopeAr: '12 قطعة مركزية، 24 علبة ترطيب، 36 طبق تقديم.',
    featured: false, sortOrder: 6,
  },
  {
    titleEn: 'The Ritz-Carlton Riyadh Custom Full Tableware',
    titleAr: 'طقم مائدة مخصص كامل لفندق ريتز كارلتون الرياض',
    clientNameEn: 'The Ritz-Carlton, Riyadh', clientNameAr: 'ريتز كارلتون، الرياض',
    locationEn: 'Hittin, Riyadh, Saudi Arabia', locationAr: 'العتين، الرياض، المملكة العربية السعودية',
    year: 2022, category: 'hotel' as const,
    coverImage: IMGS.heroTableware,
    images: [IMGS.heroTableware, IMGS.catTableware, IMGS.catHotel],
    descEn: 'Fully custom 2400-piece service with palace-culture motifs. Trained the hotel stewarding team on proper care.',
    descAr: 'خدمة مخصصة كاملة 2400 قطعة بزخارف القصر الثقافي. تدريب فريق الفندق على العناية الصحيحة.',
    scopeEn: '2400 pieces total, including 4 private dining custom sets.',
    scopeAr: '2400 قطعة إجمالاً بما في ذلك 4 طقومات طعام خاصة.',
    featured: false, sortOrder: 7,
  },
  {
    titleEn: 'Emirates Palace Custom Tilework Project',
    titleAr: 'مشروع بلاط سيراميك مخصص بقصر الإمارات',
    clientNameEn: 'Emirates Palace, Abu Dhabi', clientNameAr: 'قصر الإمارات، أبوظبي',
    locationEn: 'West Corniche, Abu Dhabi', locationAr: 'الكورنيش الغربي، أبوظبي',
    year: 2023, category: 'hotel' as const,
    coverImage: IMGS.catTiles,
    images: [IMGS.catTiles, IMGS.catHotel, IMGS.aboutGlaze],
    descEn: '1,800 sqm of custom glazed tile, including the signature gold-inlay tile for the new wing corridors.',
    descAr: '1800 متر مربع من البلاط المزجج المخصص بما في ذلك بلاط الحشوات الذهبية المميز لممرات الجناح الجديد.',
    scopeEn: '1,800 sqm custom ceramic tilework.',
    scopeAr: '1800 متر مربع من بلاط السيراميك المخصص.',
    featured: false, sortOrder: 8,
  },
];

async function main(skipExit = false) {
  await connectDB();
  console.log('[Seed] 正在写入产品 / 案例 / 管理员 ...');

  // 管理员
  const existAdmin = await Admin.findOne({ username: env.ADMIN_DEFAULT_USERNAME });
  if (!existAdmin) {
    const hash = await bcrypt.hash(env.ADMIN_DEFAULT_PASSWORD, 10);
    await Admin.create({
      username: env.ADMIN_DEFAULT_USERNAME,
      passwordHash: hash,
      role: 'superadmin',
    });
    console.log(`  ✅ 管理员创建成功 → ${env.ADMIN_DEFAULT_USERNAME} / ${env.ADMIN_DEFAULT_PASSWORD}`);
  } else {
    console.log(`  ℹ️ 管理员 ${env.ADMIN_DEFAULT_USERNAME} 已存在，跳过创建（密码仍为环境变量）`);
  }

  // 清空并重建产品
  await Product.deleteMany({});
  await Product.create(products as any);
  console.log(`  ✅ 写入产品 ${products.length} 条`);

  // 清空并重建案例
  await CaseModel.deleteMany({});
  await CaseModel.create(cases as any);
  console.log(`  ✅ 写入案例 ${cases.length} 条`);

  // 生产演示友好：保留历史询盘/订单；开发时如需重置可手动 drop db
  const [inq, ord] = await Promise.all([Inquiry.countDocuments(), Order.countDocuments()]);
  console.log(`  ℹ️ 现有询盘 ${inq} 条 / 订单 ${ord} 条（保留，未清空）`);

  console.log('[Seed] ✅ 全部完成。可 Ctrl+C 退出。');
  if (!skipExit) process.exit(0);
}

if (require.main === module) {
  main().catch(e => { console.error('[Seed] 失败 ❌', e); process.exit(1); });
}

export { main as runSeed };
