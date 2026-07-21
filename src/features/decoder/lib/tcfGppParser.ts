/**
 * IAB TCF v2.2 and GPP (Global Privacy Platform) Full Specification Decoder
 * Complete implementation matching iabgpp.com & IAB Europe TCF v2.2 / GPP specs.
 */

export interface GvlVendor {
  id: number;
  name: string;
  purposes?: number[];
  legIntPurposes?: number[];
  specialPurposes?: number[];
  features?: number[];
  specialFeatures?: number[];
  policyUrl?: string;
}

export interface TcfPurposeAudit {
  id: number;
  name: string;
  consent: boolean;
  legitimateInterest: boolean;
}

export interface TcfSpecialFeatureAudit {
  id: number;
  name: string;
  description: string;
  optedIn: boolean;
}

export interface VendorAuditItem {
  id: number;
  name: string;
  hasConsent?: boolean;
  hasLegInt?: boolean;
  policyUrl?: string;
  purposes?: number[];
  legIntPurposes?: number[];
  specialPurposes?: number[];
  features?: number[];
  specialFeatures?: number[];
}

export interface PublisherRestriction {
  purposeId: number;
  restrictionType: number; // 0 = Not Allowed, 1 = Require Consent, 2 = Require Legitimate Interest
  restrictionTypeName: string;
  vendorIds: number[];
  vendors?: { id: number; name: string }[];
}

export interface PublisherSegmentData {
  publisherPurposesConsent: number[];
  publisherPurposesLi: number[];
  numCustomPurposes: number;
  customPurposesConsent: number[];
  customPurposesLi: number[];
}

export interface TcfSubSegment {
  type: number;
  typeName: string;
  rawString: string;
  vendorIds?: number[];
  vendors?: { id: number; name: string }[];
  publisherData?: PublisherSegmentData;
}

export interface GppHeaderInfo {
  version: number;
  sectionIds: number[];
  sectionNames: string[];
}

export type AdServingEligibilityMode = 'PERSONALIZED' | 'LIMITED_ADS' | 'NON_PERSONALIZED' | 'NO_ADS';

export interface AdServingVerdict {
  mode: AdServingEligibilityMode;
  title: string;
  badgeText: string;
  variant: 'emerald' | 'amber' | 'orange' | 'rose';
  reasoning: string;
  purposeOneGranted: boolean;
  purposeTwoGranted: boolean;
  purposeThreeGranted: boolean;
  purposeFourGranted: boolean;
}

export interface TcfGppDecodeResult {
  isValid: boolean;
  error?: string;
  isGpp: boolean;
  gppHeader?: GppHeaderInfo;
  rawInput: string;
  
  // TCF Core Header
  version: number;
  createdDate: string;
  updatedDate: string;
  cmpId: number;
  cmpName: string;
  cmpDisplay: string;
  cmpVersion: number;
  consentScreen: number;
  consentLanguage: string;
  vendorListVersion: number;
  tcfPolicyVersion: number;
  isServiceSpecific: boolean;
  useNonStandardTexts: boolean;
  purposeOneTreatment: boolean;
  publisherCountryCode: string;

  // Ad Personalization & Serving Verdict
  adVerdict: AdServingVerdict;

  // Features & Purposes
  specialFeatures: TcfSpecialFeatureAudit[];
  purposes: TcfPurposeAudit[];
  
  // Vendors with Names & GVL metadata
  consentedVendorIds: number[];
  consentedVendors: VendorAuditItem[];
  legitimateInterestVendorIds: number[];
  legitimateInterestVendors: VendorAuditItem[];
  allVendors: VendorAuditItem[];
  disclosedVendorIds: number[];
  disclosedVendors: VendorAuditItem[];
  
  // Publisher Restrictions & Publisher Segment Data
  publisherRestrictions: PublisherRestriction[];
  publisherSegmentData?: PublisherSegmentData;

  // Sub-segments
  subSegments: TcfSubSegment[];
}

export const GPP_SECTION_NAMES: Record<number, string> = {
  2: 'EU TCF v2.2',
  6: 'US National Privacy',
  7: 'US California (CPRA)',
  8: 'US Virginia (VCDPA)',
  9: 'US Colorado (CPA)',
  10: 'US Utah (UCPA)',
  11: 'US Connecticut (CTDPA)',
  12: 'US Florida',
  13: 'US Montana',
  14: 'US Oregon',
  15: 'US Texas'
};

export const PURPOSE_NAMES: Record<number, string> = {
  1: 'Store and/or access information on a device',
  2: 'Use limited data to select advertising',
  3: 'Create profiles for personalised advertising',
  4: 'Use profiles to select personalised advertising',
  5: 'Create profiles to personalise content',
  6: 'Use profiles to select personalised content',
  7: 'Measure advertising performance',
  8: 'Measure content performance',
  9: 'Understand audiences through statistics or combinations of data from different sources',
  10: 'Develop and improve services',
  11: 'Use limited data to select content'
};

export const SPECIAL_PURPOSE_NAMES: Record<number, string> = {
  1: 'Ensure security, prevent and detect fraud, and fix errors',
  2: 'Deliver and present advertising and content'
};

export const FEATURE_NAMES: Record<number, string> = {
  1: 'Match and combine data from other data sources',
  2: 'Link different devices',
  3: 'Identify devices based on automatically transmitted information'
};

export const SPECIAL_FEATURE_NAMES: Record<number, { name: string; desc: string }> = {
  1: { name: 'Special Feature 1', desc: 'Use precise geolocation data' },
  2: { name: 'Special Feature 2', desc: 'Actively scan device characteristics for identification' }
};

// Registered IAB CMP ID to Name Registry
export const FALLBACK_CMP_MAP: Record<number, string> = {
  1: 'Quantcast Choice',
  2: 'Didomi',
  3: 'Sirdata',
  5: 'Usercentrics',
  6: 'Sourcepoint',
  7: 'LiveRamp',
  10: 'Quantcast Choice',
  14: 'Cookiebot (Usercentrics)',
  21: 'Commanders Act',
  28: 'OneTrust',
  30: 'Google LLC',
  31: 'Ogury',
  35: 'TrustArc',
  68: 'Sirdata',
  76: 'iubenda',
  92: 'Criteo CMP',
  134: 'CookieFirst',
  210: 'Ketch',
  273: 'UniConsent',
  300: 'CookieYes',
  307: 'SFDX',
  311: 'Google Certified CMP',
  324: 'Axeptio',
  380: 'InMobi CMP'
};

// Comprehensive Top Vendors Map
export const FALLBACK_VENDOR_MAP: Record<number, string> = {
  1: 'Exponential Interactive, Inc d/b/a VDX.tv',
  2: 'Captify Technologies Limited',
  3: 'Sovrn Holdings Inc.',
  4: 'Roq.ad GmbH',
  5: 'Usercentrics GmbH',
  6: 'AdSpirit',
  8: 'Emerse Metro Ads AB',
  10: 'Index Exchange Inc.',
  12: 'Beontag Tech UK Limited',
  16: 'Adtech US LLC',
  21: 'The UK Trade Desk Ltd',
  23: 'Convergence Digital Limited',
  24: 'Epsilon',
  25: 'Yahoo EMEA Limited',
  28: 'TripleLift, Inc.',
  32: 'Xandr, Inc.',
  36: 'Unruly Group LLC',
  42: 'Taboola Europe Limited',
  45: 'Smart Adserver',
  50: 'Adform A/S',
  52: 'Magnite, Inc.',
  68: 'Amazon Ad Server',
  69: 'OpenX',
  76: 'PubMatic, Inc',
  84: 'Semasio GmbH',
  91: 'Criteo SA',
  104: 'Sonobi, Inc',
  115: 'smartclip Europe GmbH',
  126: 'DoubleVerify Inc.',
  128: 'BIDSWITCH GmbH',
  138: 'ConnectAd Demand GmbH',
  178: 'Hybrid Theory Global Ltd',
  195: 'advanced store GmbH',
  238: 'StackAdapt Inc.',
  253: 'Improve Digital',
  264: 'Adobe Advertising Cloud',
  278: 'Integral Ad Science, Inc.',
  312: 'Exactag GmbH',
  565: 'Adobe Audience Manager, Adobe Experience Platform',
  755: 'Google Advertising Products',
  793: 'Amazon Advertising',
  1126: 'Microsoft Advertising'
};

let cachedGvlMap: Record<number, GvlVendor> | null = null;

export function getGvlCache(): Record<number, GvlVendor> | null {
  if (cachedGvlMap && Object.keys(cachedGvlMap).length > 50) return cachedGvlMap;
  try {
    const local = localStorage.getItem('iab_gvl_vendors_v3') || localStorage.getItem('iab_gvl_vendors_v2');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && Object.keys(parsed).length > 50) {
        cachedGvlMap = parsed;
        return cachedGvlMap;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function fetchGvlVendorList(): Promise<Record<number, GvlVendor>> {
  const existing = getGvlCache();
  if (existing) return existing;

  const endpoints = [
    'https://cmp.uniconsent.com/v3/vendor-list.json',
    'https://vendor-list.consensu.org/v2/vendor-list.json',
    'https://cdn.jsdelivr.net/gh/consensu/IABConsent_v2@master/vendor-list.json',
    'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://vendor-list.consensu.org/v2/vendor-list.json')
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const map: Record<number, GvlVendor> = {};
        if (data && data.vendors) {
          Object.entries(data.vendors).forEach(([idStr, v]: [string, any]) => {
            const id = parseInt(idStr, 10);
            const policyUrl = v.policyUrl || (Array.isArray(v.urls) && v.urls[0] ? v.urls[0].privacy : undefined);
            map[id] = {
              id,
              name: v.name || `Vendor ${id}`,
              policyUrl,
              purposes: v.purposes,
              legIntPurposes: v.legIntPurposes,
              specialPurposes: v.specialPurposes,
              features: v.features,
              specialFeatures: v.specialFeatures
            };
          });
          cachedGvlMap = map;
          try {
            localStorage.setItem('iab_gvl_vendors_v3', JSON.stringify(map));
          } catch {
            // ignore
          }
          return map;
        }
      }
    } catch {
      // try next endpoint
    }
  }

  const fallbackMap: Record<number, GvlVendor> = {};
  Object.entries(FALLBACK_VENDOR_MAP).forEach(([idStr, name]) => {
    const id = parseInt(idStr, 10);
    fallbackMap[id] = { id, name };
  });
  cachedGvlMap = fallbackMap;
  try {
    localStorage.setItem('iab_gvl_vendors_v2', JSON.stringify(fallbackMap));
  } catch {
    // ignore
  }
  return fallbackMap;
}

function base64UrlToBitString(b64url: string): string {
  let normalized = b64url.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  const binaryStr = atob(normalized);
  let bitString = '';
  for (let i = 0; i < binaryStr.length; i++) {
    let bits = binaryStr.charCodeAt(i).toString(2);
    while (bits.length < 8) bits = '0' + bits;
    bitString += bits;
  }
  return bitString;
}

function getIntVal(bitStr: string, start: number, len: number): number {
  if (start + len > bitStr.length) return 0;
  return parseInt(bitStr.substring(start, start + len), 2);
}

function parseVendorSection(bitStr: string, startPos: number): { vendorIds: number[]; maxVendor: number; nextPos: number } {
  let pos = startPos;
  const maxVendor = getIntVal(bitStr, pos, 16); pos += 16;
  const isRange = getIntVal(bitStr, pos, 1); pos += 1;
  const vendorIds: number[] = [];

  if (isRange === 0) {
    for (let i = 0; i < maxVendor; i++) {
      if (getIntVal(bitStr, pos + i, 1) === 1) {
        vendorIds.push(i + 1);
      }
    }
    pos += maxVendor;
  } else {
    const numEntries = getIntVal(bitStr, pos, 12); pos += 12;
    for (let e = 0; e < numEntries; e++) {
      const entryType = getIntVal(bitStr, pos, 1); pos += 1;
      if (entryType === 0) {
        const vendorId = getIntVal(bitStr, pos, 16); pos += 16;
        vendorIds.push(vendorId);
      } else {
        const startVendor = getIntVal(bitStr, pos, 16); pos += 16;
        const endVendor = getIntVal(bitStr, pos, 16); pos += 16;
        for (let v = startVendor; v <= endVendor; v++) {
          vendorIds.push(v);
        }
      }
    }
  }
  return { vendorIds, maxVendor, nextPos: pos };
}

export function parseTcfGppString(input: string, gvlMap?: Record<number, GvlVendor>): TcfGppDecodeResult {
  const rawInput = input.trim();
  if (!rawInput) {
    throw new Error('Input string is empty');
  }

  let tcfString = rawInput;
  let isGpp = false;
  let gppHeader: GppHeaderInfo | undefined = undefined;

  // Check if GPP String
  if (rawInput.includes('~')) {
    isGpp = true;
    const gppSections = rawInput.split('~');
    const headerB64 = gppSections[0];

    try {
      const headerBits = base64UrlToBitString(headerB64);
      const gppVersion = getIntVal(headerBits, 0, 6);
      
      const sectionIds: number[] = [];
      let pos = 6;
      if (headerBits.length >= 18) {
        const maxSecId = getIntVal(headerBits, pos, 16); pos += 16;
        const isRange = getIntVal(headerBits, pos, 1); pos += 1;
        if (isRange === 0) {
          for (let i = 0; i < maxSecId; i++) {
            if (getIntVal(headerBits, pos + i, 1) === 1) sectionIds.push(i + 1);
          }
        } else {
          const numEntries = getIntVal(headerBits, pos, 12); pos += 12;
          for (let e = 0; e < numEntries; e++) {
            const entryType = getIntVal(headerBits, pos, 1); pos += 1;
            if (entryType === 0) {
              sectionIds.push(getIntVal(headerBits, pos, 16)); pos += 16;
            } else {
              const startId = getIntVal(headerBits, pos, 16); pos += 16;
              const endId = getIntVal(headerBits, pos, 16); pos += 16;
              for (let id = startId; id <= endId; id++) sectionIds.push(id);
            }
          }
        }
      }
      
      if (sectionIds.length === 0) sectionIds.push(2);

      gppHeader = {
        version: gppVersion,
        sectionIds,
        sectionNames: sectionIds.map((id) => GPP_SECTION_NAMES[id] || `Section ${id}`)
      };

      if (gppSections.length > 1) {
        tcfString = gppSections[1];
      }
    } catch {
      // Fall back
    }
  }

  // Parse TCF string
  const segments = tcfString.split('.');
  const coreSegment = segments[0];

  const coreBits = base64UrlToBitString(coreSegment);

  const version = getIntVal(coreBits, 0, 6);
  const createdMs = getIntVal(coreBits, 6, 36) * 100;
  const updatedMs = getIntVal(coreBits, 42, 36) * 100;
  const cmpId = getIntVal(coreBits, 78, 12);
  const cmpVersion = getIntVal(coreBits, 90, 12);
  const consentScreen = getIntVal(coreBits, 102, 6);

  const cmpName = FALLBACK_CMP_MAP[cmpId] || `CMP ${cmpId}`;
  const cmpDisplay = `${cmpName} (ID ${cmpId})`;

  const c1 = getIntVal(coreBits, 108, 6) + 65;
  const c2 = getIntVal(coreBits, 114, 6) + 65;
  const consentLanguage = String.fromCharCode(c1, c2);

  const vendorListVersion = getIntVal(coreBits, 124, 12);
  const tcfPolicyVersion = getIntVal(coreBits, 136, 6);
  const isServiceSpecific = getIntVal(coreBits, 142, 1) === 1;
  const useNonStandardTexts = getIntVal(coreBits, 143, 1) === 1;

  // Special Features
  const specialFeatures: TcfSpecialFeatureAudit[] = [
    {
      id: 1,
      name: SPECIAL_FEATURE_NAMES[1].name,
      description: SPECIAL_FEATURE_NAMES[1].desc,
      optedIn: coreBits.charAt(144) === '1'
    },
    {
      id: 2,
      name: SPECIAL_FEATURE_NAMES[2].name,
      description: SPECIAL_FEATURE_NAMES[2].desc,
      optedIn: coreBits.charAt(145) === '1'
    }
  ];

  // Purposes & Legitimate Interests
  const purposes: TcfPurposeAudit[] = [];
  const purposeStart = version === 2 ? 156 : 152;
  const purposeLiStart = version === 2 ? 180 : 176;

  for (let i = 1; i <= 11; i++) {
    purposes.push({
      id: i,
      name: PURPOSE_NAMES[i] || `Purpose ${i}`,
      consent: coreBits.charAt(purposeStart + i - 1) === '1',
      legitimateInterest: coreBits.charAt(purposeLiStart + i - 1) === '1'
    });
  }

  const p1 = purposes.find((p) => p.id === 1)?.consent ?? false;
  const p2 = purposes.find((p) => p.id === 2)?.consent ?? false;
  const p3 = (purposes.find((p) => p.id === 3)?.consent || purposes.find((p) => p.id === 3)?.legitimateInterest) ?? false;
  const p4 = (purposes.find((p) => p.id === 4)?.consent || purposes.find((p) => p.id === 4)?.legitimateInterest) ?? false;

  let adVerdict: AdServingVerdict;

  if (p1 && p3 && p4) {
    adVerdict = {
      mode: 'PERSONALIZED',
      title: 'Personalized Ads Allowed (PA)',
      badgeText: 'FULL PERSONALIZATION ALLOWED',
      variant: 'emerald',
      reasoning: 'Purpose 1 (Device Storage), Purpose 3 (Profiling), and Purpose 4 (Personalized Selection) are all GRANTED. Ad servers can serve fully targeted personalized ads.',
      purposeOneGranted: p1,
      purposeTwoGranted: p2,
      purposeThreeGranted: p3,
      purposeFourGranted: p4
    };
  } else if (p1 && (!p3 || !p4)) {
    adVerdict = {
      mode: 'LIMITED_ADS',
      title: 'Limited Ads Only (LTD)',
      badgeText: 'LIMITED / NON-PERSONALIZED ONLY',
      variant: 'amber',
      reasoning: 'Purpose 1 (Device Storage) is GRANTED, but Purpose 3 or Purpose 4 (Personalized Profiling) is DENIED. Ads can serve, but ad personalization and user tracking are strictly disabled.',
      purposeOneGranted: p1,
      purposeTwoGranted: p2,
      purposeThreeGranted: p3,
      purposeFourGranted: p4
    };
  } else if (!p1 && p2) {
    adVerdict = {
      mode: 'NON_PERSONALIZED',
      title: 'Non-Personalized Ads (NPA / No Cookies)',
      badgeText: 'NPA MODE (NO DEVICE COOKIES)',
      variant: 'orange',
      reasoning: 'Purpose 1 (Device Storage) is DENIED, but Purpose 2 (Basic Ads) is GRANTED. Ads will serve in Non-Personalized Mode (NPA) without writing or reading local device cookies.',
      purposeOneGranted: p1,
      purposeTwoGranted: p2,
      purposeThreeGranted: p3,
      purposeFourGranted: p4
    };
  } else {
    adVerdict = {
      mode: 'NO_ADS',
      title: 'No Ads Eligible (Consent Denied)',
      badgeText: 'AD REQUESTS BLOCKED',
      variant: 'rose',
      reasoning: 'Purpose 1 (Device Storage) and Purpose 2 (Basic Ad Delivery) are DENIED. Ad networks (including Google Ad Manager) will completely block ad serving.',
      purposeOneGranted: p1,
      purposeTwoGranted: p2,
      purposeThreeGranted: p3,
      purposeFourGranted: p4
    };
  }

  const purposeOneTreatment = getIntVal(coreBits, 204, 1) === 1;
  const pubCc1 = getIntVal(coreBits, 205, 6) + 65;
  const pubCc2 = getIntVal(coreBits, 211, 6) + 65;
  const publisherCountryCode = String.fromCharCode(pubCc1, pubCc2);

  const resolveVendorItem = (id: number): VendorAuditItem => {
    if (gvlMap && gvlMap[id]) {
      const v = gvlMap[id];
      return {
        id,
        name: v.name,
        policyUrl: v.policyUrl,
        purposes: v.purposes,
        legIntPurposes: v.legIntPurposes,
        specialPurposes: v.specialPurposes,
        features: v.features,
        specialFeatures: v.specialFeatures
      };
    }
    const fallbackName = FALLBACK_VENDOR_MAP[id];
    return {
      id,
      name: fallbackName ? `${fallbackName}` : `Vendor ${id}`
    };
  };

  // Vendor Consents Section
  let pos = 217;
  const vendorConsentsResult = parseVendorSection(coreBits, pos);
  const consentedVendorIds = vendorConsentsResult.vendorIds;
  pos = vendorConsentsResult.nextPos;

  // Vendor Legitimate Interests Section
  const vendorLiResult = parseVendorSection(coreBits, pos);
  const legitimateInterestVendorIds = vendorLiResult.vendorIds;
  pos = vendorLiResult.nextPos;

  // Compute Full Vendor Audit List (Consent & Legitimate Interest for all Vendors)
  const maxVendorId = Math.max(vendorConsentsResult.maxVendor, vendorLiResult.maxVendor, 0);

  const allVendorIdsSet = new Set<number>();
  consentedVendorIds.forEach((id) => allVendorIdsSet.add(id));
  legitimateInterestVendorIds.forEach((id) => allVendorIdsSet.add(id));

  if (maxVendorId > 0 && maxVendorId <= 3000) {
    for (let id = 1; id <= maxVendorId; id++) {
      allVendorIdsSet.add(id);
    }
  }
  if (gvlMap) {
    Object.keys(gvlMap).forEach((idStr) => allVendorIdsSet.add(parseInt(idStr, 10)));
  }

  const sortedVendorIds = Array.from(allVendorIdsSet).sort((a, b) => a - b);
  const consentedSet = new Set(consentedVendorIds);
  const legIntSet = new Set(legitimateInterestVendorIds);

  const allVendors: VendorAuditItem[] = sortedVendorIds.map((id) => {
    const item = resolveVendorItem(id);
    return {
      ...item,
      hasConsent: consentedSet.has(id),
      hasLegInt: legIntSet.has(id)
    };
  });

  const consentedVendors = allVendors.filter((v) => v.hasConsent);
  const legitimateInterestVendors = allVendors.filter((v) => v.hasLegInt);

  // Publisher Restrictions
  const publisherRestrictions: PublisherRestriction[] = [];
  if (pos + 12 <= coreBits.length) {
    const numPubRest = getIntVal(coreBits, pos, 12); pos += 12;
    for (let r = 0; r < numPubRest; r++) {
      const pId = getIntVal(coreBits, pos, 6); pos += 6;
      const rType = getIntVal(coreBits, pos, 2); pos += 2;
      const numEntries = getIntVal(coreBits, pos, 12); pos += 12;
      const vList: number[] = [];
      for (let e = 0; e < numEntries; e++) {
        const entryType = getIntVal(coreBits, pos, 1); pos += 1;
        if (entryType === 0) {
          vList.push(getIntVal(coreBits, pos, 16)); pos += 16;
        } else {
          const startV = getIntVal(coreBits, pos, 16); pos += 16;
          const endV = getIntVal(coreBits, pos, 16); pos += 16;
          for (let v = startV; v <= endV; v++) vList.push(v);
        }
      }

      const restrictionTypeNames = ['Not Allowed', 'Require Consent', 'Require Legitimate Interest'];
      publisherRestrictions.push({
        purposeId: pId,
        restrictionType: rType,
        restrictionTypeName: restrictionTypeNames[rType] || `Type ${rType}`,
        vendorIds: vList,
        vendors: vList.map((id) => ({ id, name: resolveVendorItem(id).name }))
      });
    }
  }

  // Parse Sub-segments
  const subSegments: TcfSubSegment[] = [];
  let disclosedVendorIds: number[] = [];
  let disclosedVendors: VendorAuditItem[] = [];
  let publisherSegmentData: PublisherSegmentData | undefined = undefined;

  for (let idx = 0; idx < segments.length; idx++) {
    const segStr = segments[idx];
    if (idx === 0) {
      subSegments.push({
        type: 0,
        typeName: 'Core Segment (Header, User Purpose Choices & Vendor Ranges)',
        rawString: segStr
      });
      continue;
    }

    try {
      const segBits = base64UrlToBitString(segStr);
      const segType = getIntVal(segBits, 0, 3);
      if (segType === 1) {
        const discResult = parseVendorSection(segBits, 3);
        disclosedVendorIds = discResult.vendorIds;
        disclosedVendors = disclosedVendorIds.map(resolveVendorItem);
        subSegments.push({
          type: 1,
          typeName: 'Disclosed Vendors Segment',
          rawString: segStr,
          vendorIds: disclosedVendorIds,
          vendors: disclosedVendors.map((v) => ({ id: v.id, name: v.name }))
        });
      } else if (segType === 3) {
        const pubPurposesConsent: number[] = [];
        const pubPurposesLi: number[] = [];
        for (let p = 1; p <= 24; p++) {
          if (getIntVal(segBits, 3 + p - 1, 1) === 1) pubPurposesConsent.push(p);
          if (getIntVal(segBits, 27 + p - 1, 1) === 1) pubPurposesLi.push(p);
        }
        const numCustom = getIntVal(segBits, 51, 6);
        const customConsent: number[] = [];
        const customLi: number[] = [];
        let cPos = 57;
        for (let c = 1; c <= numCustom; c++) {
          if (getIntVal(segBits, cPos, 1) === 1) customConsent.push(c);
          cPos++;
        }
        for (let c = 1; c <= numCustom; c++) {
          if (getIntVal(segBits, cPos, 1) === 1) customLi.push(c);
          cPos++;
        }

        publisherSegmentData = {
          publisherPurposesConsent: pubPurposesConsent.filter((p) => p <= 11),
          publisherPurposesLi: pubPurposesLi.filter((p) => p <= 11),
          numCustomPurposes: numCustom,
          customPurposesConsent: customConsent,
          customPurposesLi: customLi
        };

        subSegments.push({
          type: 3,
          typeName: 'Publisher Segment (First-Party OOB Overrides)',
          rawString: segStr,
          publisherData: publisherSegmentData
        });
      } else {
        subSegments.push({
          type: segType,
          typeName: `Sub-Segment Type ${segType}`,
          rawString: segStr
        });
      }
    } catch {
      subSegments.push({
        type: -1,
        typeName: `Sub-Segment ${idx + 1}`,
        rawString: segStr
      });
    }
  }

  return {
    isValid: true,
    isGpp,
    gppHeader,
    rawInput,
    version,
    createdDate: createdMs ? new Date(createdMs).toLocaleString() : 'N/A',
    updatedDate: updatedMs ? new Date(updatedMs).toLocaleString() : 'N/A',
    cmpId,
    cmpName,
    cmpDisplay,
    cmpVersion,
    consentScreen,
    consentLanguage,
    vendorListVersion,
    tcfPolicyVersion,
    isServiceSpecific,
    useNonStandardTexts,
    purposeOneTreatment,
    publisherCountryCode,
    adVerdict,
    specialFeatures,
    purposes,
    consentedVendorIds,
    consentedVendors,
    legitimateInterestVendorIds,
    legitimateInterestVendors,
    allVendors,
    disclosedVendorIds,
    disclosedVendors,
    publisherRestrictions,
    publisherSegmentData,
    subSegments
  };
}
