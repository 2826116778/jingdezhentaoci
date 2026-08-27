/**
 * Seed MarketConfig — 初始化主要目标国家的市场配置。
 * 可在 backend 启动时调用，或在 /console/development 首次访问时 auto-seed。
 */
import MarketConfig from '../models/MarketConfig';

const DEFAULT_MARKETS = [
  { countryCode: 'AE', countryName: 'UAE',            priority: 100, cities: ['Dubai', 'Abu Dhabi', 'Sharjah'],     defaultProductInterests: ['Hotelware', 'Dinnerware', 'Tea Set', 'Coffee Set', 'Custom Ceramics'] },
  { countryCode: 'SA', countryName: 'Saudi Arabia',  priority: 95,  cities: ['Riyadh', 'Jeddah', 'Dammam'],       defaultProductInterests: ['Tableware', 'Tea Set', 'Home Decor', 'Giftware'] },
  { countryCode: 'QA', countryName: 'Qatar',          priority: 90,  cities: ['Doha', 'Al Rayyan', 'Al Wakrah'],   defaultProductInterests: ['Hotelware', 'Dinnerware', 'Vases', 'Home Decor'] },
  { countryCode: 'KW', countryName: 'Kuwait',          priority: 85,  cities: ['Kuwait City', 'Hawalli', 'Salmiya'],defaultProductInterests: ['Tableware', 'Tea Set', 'Giftware', 'Home Decor'] },
  { countryCode: 'OM', countryName: 'Oman',            priority: 75,  cities: ['Muscat', 'Salalah', 'Sohar'],       defaultProductInterests: ['Tableware', 'Home Decor', 'Vases'] },
  { countryCode: 'BH', countryName: 'Bahrain',         priority: 72,  cities: ['Manama', 'Riffa', 'Muharraq'],       defaultProductInterests: ['Tableware', 'Dinnerware', 'Home Decor'] },
  { countryCode: 'US', countryName: 'United States',   priority: 85,  cities: ['New York', 'Los Angeles', 'Chicago', 'Miami'], defaultProductInterests: ['Art Ceramics', 'Home Decor', 'Vases', 'Giftware', 'Custom Ceramics'] },
  { countryCode: 'GB', countryName: 'United Kingdom',   priority: 80,  cities: ['London', 'Manchester', 'Birmingham'], defaultProductInterests: ['Art Ceramics', 'Home Decor', 'Tableware'] },
  { countryCode: 'DE', countryName: 'Germany',         priority: 78,  cities: ['Berlin', 'Munich', 'Frankfurt'],    defaultProductInterests: ['Tableware', 'Coffee Set', 'Art Ceramics'] },
  { countryCode: 'FR', countryName: 'France',           priority: 77,  cities: ['Paris', 'Lyon', 'Marseille'],       defaultProductInterests: ['Art Ceramics', 'Home Decor', 'Tableware'] },
  { countryCode: 'IT', countryName: 'Italy',            priority: 75,  cities: ['Rome', 'Milan', 'Florence'],         defaultProductInterests: ['Art Ceramics', 'Home Decor', 'Vases'] },
  { countryCode: 'ES', countryName: 'Spain',            priority: 70,  cities: ['Madrid', 'Barcelona', 'Valencia'],   defaultProductInterests: ['Tableware', 'Home Decor', 'Vases'] },
  { countryCode: 'JP', countryName: 'Japan',            priority: 72,  cities: ['Tokyo', 'Osaka', 'Kyoto'],           defaultProductInterests: ['Tea Set', 'Art Ceramics', 'Vases', 'Home Decor'] },
  { countryCode: 'KR', countryName: 'South Korea',     priority: 70,  cities: ['Seoul', 'Busan', 'Incheon'],         defaultProductInterests: ['Tea Set', 'Tableware', 'Home Decor'] },
  { countryCode: 'AU', countryName: 'Australia',         priority: 68,  cities: ['Sydney', 'Melbourne', 'Brisbane'],   defaultProductInterests: ['Tableware', 'Home Decor', 'Giftware'] },
  { countryCode: 'CA', countryName: 'Canada',           priority: 66,  cities: ['Toronto', 'Vancouver', 'Montreal'],  defaultProductInterests: ['Tableware', 'Home Decor', 'Giftware'] },
  { countryCode: 'NL', countryName: 'Netherlands',       priority: 65,  cities: ['Amsterdam', 'Rotterdam', 'The Hague'], defaultProductInterests: ['Tableware', 'Art Ceramics', 'Home Decor'] },
  { countryCode: 'TR', countryName: 'Turkey',            priority: 60,  cities: ['Istanbul', 'Ankara', 'Izmir'],       defaultProductInterests: ['Tableware', 'Home Decor', 'Vases'] },
  { countryCode: 'SG', countryName: 'Singapore',         priority: 63,  cities: ['Singapore', 'Jurong', 'Tampines'],  defaultProductInterests: ['Hotelware', 'Tableware', 'Tea Set'] },
  { countryCode: 'MY', countryName: 'Malaysia',          priority: 58,  cities: ['Kuala Lumpur', 'Johor Bahru', 'Penang'], defaultProductInterests: ['Tableware', 'Tea Set', 'Home Decor'] },
];

export async function seedMarketConfig(force = false) {
  if (force) {
    await MarketConfig.deleteMany({});
  }
  const count = await MarketConfig.countDocuments();
  if (count > 0) return count;
  const docs = await MarketConfig.insertMany(DEFAULT_MARKETS);
  return docs.length;
}

export default seedMarketConfig;
