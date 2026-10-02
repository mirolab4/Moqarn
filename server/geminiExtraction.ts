import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractionItem {
  name: string;
  price: number;
  discount: number;
  bonusBuy: number;
  bonusFree: number;
  bonusText: string;
  effectivePrice: number;
  expiry: string;
  uncertain: boolean;
}

export function calculateEffectivePrice(price: number, discount: number, bonusBuy: number, bonusFree: number): number {
  const p = Math.max(0, Number(price) || 0);
  const d = Math.max(0, Math.min(100, Number(discount) || 0));
  const buy = Math.max(0, Number(bonusBuy) || 0);
  const free = Math.max(0, Number(bonusFree) || 0);

  const discountMultiplier = 1 - (d / 100);
  let effective = p * discountMultiplier;

  if (buy > 0 && free > 0) {
    effective = effective * (buy / (buy + free));
  }

  return Math.round(effective * 100) / 100;
}

export async function extractDrugsWithGemini(params: {
  images?: Array<{ mimeType: string; data: string }>;
  pdf?: { mimeType: string; data: string };
  pastedText?: string;
}): Promise<ExtractionItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const promptParts: any[] = [];

  const systemInstructions = `
أنت خبير صيدلاني متخصص في استخراج قوائم أسعار الأدوية من شركات ومستودعات التوزيع باللغتين العربية والإنجليزية.
مهمتك:
1. استخراج كل صنف دوائي بدقة (الاسم التجاري أو العلمي مثل: Panadol Extra, كونكور 5 ملغ, أوغمنتين 1 جم, إلخ).
2. استخراج سعر الجملة الأساسي (price) كرقم عشري موجب.
3. استخراج نسبة الخصم المئوية (discount) كنسبة رقمية (مثلاً 5 تعني 5%، إذا لم يوجد ضع 0).
4. استخراج شروط البونص (bonus):
   - إذا كان مكتوباً "10+1" أو "بونص 10+2" أو "12+3":
     - bonusBuy: عدد العلب المشتراة (10)
     - bonusFree: عدد العلب المجانية (1)
     - bonusText: "10+1"
   - إذا لم يوجد بونص: bonusBuy=0, bonusFree=0, bonusText="0".
5. استخراج تاريخ الصلاحية إن وجد (expiry) أو تركه فارغاً.
6. إذا كانت الصورة غير واضحة أو السعر مشكوكاً فيه أو مقصوصاً أو مستنتجاً بغير يقين، عيّن uncertain=true.
7. في حال وجود نص رسالة مصاحب للصورة، قم بدمجه بذكاء: فقد يحتوي النص على أسعار معدلة أو أصناف غير موجودة في الصورة.
`;

  promptParts.push({
    text: systemInstructions
  });

  if (params.pastedText && params.pastedText.trim()) {
    promptParts.push({
      text: `نص الرسالة المصاحبة أو القائمة المكتوبة:\n${params.pastedText.trim()}`
    });
  }

  if (params.pdf && params.pdf.data) {
    promptParts.push({
      inlineData: {
        mimeType: params.pdf.mimeType || 'application/pdf',
        data: params.pdf.data
      }
    });
  }

  if (params.images && params.images.length > 0) {
    for (const img of params.images) {
      if (img.data) {
        promptParts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.data
          }
        });
      }
    }
  }

  promptParts.push({
    text: "استخرج كافة الأصناف الدوائية الموجودة وأرجعها بصيغة JSON مطابقة تماماً للمخطط المطلوب دون أي نصوص إضافية."
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: promptParts
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description: "قائمة الأصناف الدوائية المستخرجة",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "اسم الدواء بالعربية أو الإنجليزية" },
                price: { type: Type.NUMBER, description: "سعر الشراء الأساسي" },
                discount: { type: Type.NUMBER, description: "نسبة الخصم المئوية (0 إن لم توجد)" },
                bonusBuy: { type: Type.NUMBER, description: "كمية الشراء للحصول على البونص" },
                bonusFree: { type: Type.NUMBER, description: "الكمية المجانية الممنوحة" },
                bonusText: { type: Type.STRING, description: "صيغة البونص مثل 10+1 أو 0" },
                expiry: { type: Type.STRING, description: "تاريخ الصلاحية إن وجد" },
                uncertain: { type: Type.BOOLEAN, description: "صحيح إذا كانت القراءة غير مؤكدة أو ضبابية" }
              },
              required: ["name", "price", "discount", "bonusBuy", "bonusFree", "bonusText", "uncertain"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  const text = response.text || "{}";
  let parsed: { items: any[] } = { items: [] };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse Gemini response as JSON:", text);
    throw new Error("فشل في معالجة مخرجات نموذج الذكاء الاصطناعي");
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

  return rawItems.map((item) => {
    const price = Math.max(0, Number(item.price) || 0);
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const bonusBuy = Math.max(0, Number(item.bonusBuy) || 0);
    const bonusFree = Math.max(0, Number(item.bonusFree) || 0);
    const bonusText = item.bonusText || (bonusBuy && bonusFree ? `${bonusBuy}+${bonusFree}` : "0");
    const effectivePrice = calculateEffectivePrice(price, discount, bonusBuy, bonusFree);

    return {
      name: String(item.name || "").trim() || "صنف غير مسمى",
      price,
      discount,
      bonusBuy,
      bonusFree,
      bonusText,
      effectivePrice,
      expiry: String(item.expiry || "").trim(),
      uncertain: Boolean(item.uncertain)
    };
  });
}
