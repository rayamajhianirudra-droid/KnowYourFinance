/**
 * Guesses a category for one receipt item from its words. The guess is
 * only a starting point on the review screen, and items it is unsure of
 * are marked so the person looks at them.
 */

const ITEM_WORDS = {
  GROCERIES: [
    "milk", "egg", "bread", "banana", "apple", "orange", "grape", "berry", "chicken", "beef", "pork",
    "turkey", "bacon", "sausage", "fish", "salmon", "shrimp", "rice", "cheese", "yogurt", "butter",
    "cereal", "pasta", "noodle", "tomato", "onion", "potato", "lettuce", "spinach", "carrot", "pepper",
    "produce", "fruit", "veg", "bean", "corn", "water", "juice", "soda", "coke", "pepsi", "sprite",
    "chips", "snack", "cookie", "cracker", "candy", "chocolate", "frozen", "ice cream", "coffee",
    "tea", "sugar", "flour", "salt", "oil", "sauce", "salsa", "soup", "tortilla", "bagel", "oat",
    "granola", "avocado", "lemon", "lime", "garlic", "cucumber", "celery", "broccoli", "gv", "organic",
  ],
  HEALTHCARE: [
    "tylenol", "ibuprofen", "advil", "aspirin", "vitamin", "medicine", "rx", "bandage", "allergy",
    "cough", "cold", "thermometer", "sunscreen", "toothpaste", "pharmacy",
  ],
  SHOPPING: [
    "tv", "television", "laptop", "computer", "phone", "tablet", "charger", "cable", "headphone",
    "speaker", "camera", "monitor", "shirt", "jeans", "pants", "shorts", "dress", "jacket", "coat",
    "shoe", "sock", "hat", "towel", "toy", "lego", "game", "puzzle", "pillow", "blanket", "lamp",
    "battery", "tool", "furniture", "chair", "table", "shelf", "bedding", "sheet", "mug", "kitchenware",
    "book", "gift", "decor", "candle", "vacuum", "mattress",
  ],
};

const RESTAURANTS = [
  "mcdonald", "starbucks", "chipotle", "subway", "restaurant", "cafe", "pizza", "grill", "diner",
  "burger", "taco", "kitchen", "bistro", "bar",
];

const GROCERS = [
  "kroger", "safeway", "aldi", "whole foods", "trader joe", "publix", "meijer", "cub foods",
  "hy-vee", "grocery", "market", "supermarket",
];

function words(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z']+/).filter(Boolean);
}

function hits(itemWords, keyword) {
  if (keyword.includes(" ")) return itemWords.join(" ").includes(keyword);
  // Very short keywords ("tv", "rx", "gv") must match a whole word.
  return itemWords.some((word) =>
    keyword.length <= 2 ? word === keyword : word === keyword || word.startsWith(keyword)
  );
}

/** Returns a function that categorizes item labels for a given store. */
export function itemCategorizer(merchant) {
  const store = String(merchant ?? "").toLowerCase();
  const isRestaurant = RESTAURANTS.some((name) => store.includes(name));
  const isGrocer = GROCERS.some((name) => store.includes(name));

  return (label) => {
    if (isRestaurant) return { category: "DINING", guessed: false };
    const itemWords = words(label);
    for (const [category, keywords] of Object.entries(ITEM_WORDS)) {
      if (keywords.some((keyword) => hits(itemWords, keyword))) {
        return { category, guessed: false };
      }
    }
    // Nothing matched: a grocery store usually sells food, a general
    // store usually sells other things. Either way, ask the person to look.
    return { category: isGrocer ? "GROCERIES" : "SHOPPING", guessed: true };
  };
}
