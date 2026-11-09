import { useEffect, useRef, useState, type RefObject } from 'react';
import { Layers, Loader2, RotateCcw, Send, ShoppingBag, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Notice } from '@/components/ui/Notice';
import { ItemDetailPanel, type DishSelection } from '@/components/visitor/ItemDetailPanel';
import { ComboDetailPanel, type ComboSubmission } from '@/components/visitor/ComboDetailPanel';
import { ComboListPanel } from '@/components/visitor/ComboListPanel';
import { LanguageSelector } from '@/components/visitor/LanguageSelector';
import { WelcomeScreen } from '@/components/visitor/WelcomeScreen';
import { BasketPanel } from '@/components/visitor/BasketPanel';
import { AssistantMarkdown } from '@/components/visitor/AssistantMarkdown';
import { ChatCardButton } from '@/components/visitor/ChatCardButton';
import { CheckoutView, type ConfirmedOrder } from '@/components/visitor/CheckoutView';
import { OrderConfirmation } from '@/components/visitor/OrderConfirmation';
import { basketLineKey, unitPriceWithExtras } from '@/lib/basketLine';
import { callFunction } from '@/lib/functions';
import { getPublicPortal, getPublicResource, getPublicDishImages, listPublicAddOns, listServingOptionsByDish, type PublicPortal } from '@/lib/portal';
import { themeAssetUrl, mascotUrl } from '@/lib/themeAssets';
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  loadBasket,
  saveBasket,
  loadConfirmedOrder,
  saveConfirmedOrder,
  scopeKey,
} from '@/lib/visitorStorage';
import { createOrder } from '@/lib/orders';
import { listVisitorCombos } from '@/lib/combos';
import { sectionLabel } from '@/lib/menuSections';
import { cn } from '@/lib/cn';
import { formatPriceInput, normalizeCurrency } from '@/lib/currency';
import type { AddOnOption, BasketItem, Dish, DishServingOption, DishVariant, ResourceType, VisitorCombo } from '@/types';

interface VisitorPageProps {
  portalId?: string;
  resourceId?: string;
  resourceType?: ResourceType;
}

interface ChatMessage {
  id: string;
  role: 'visitor' | 'bot';
  text: string;
  dishes: Dish[];
  combos?: VisitorCombo[];
  sectionHeadings?: Record<string, string> | null;
}

interface LoadedView {
  restaurantId: string;
  name: string;
  restaurantName?: string;
  city: string;
  currency: string;
  resourceId?: string;
  resourceType?: ResourceType;
  chatBackgroundPath?: string | null;
  tableServiceEnabled?: boolean;
  tableServiceCharge?: number;
  roomServiceEnabled?: boolean;
  roomServiceCharge?: number;
}

type VisitorOverlay = null | 'basket' | 'checkout' | 'confirmation' | 'combos';

function toHistory(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((message) => message.text.trim().length > 0)
    .map((message) => ({
      role: message.role === 'visitor' ? ('user' as const) : ('assistant' as const),
      content: message.text,
    }));
}

function useVisibleHeight(ref: RefObject<HTMLDivElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const viewport = window.visualViewport;
    if (!node || !viewport) return;

    const apply = () => {
      const visible = Math.min(viewport.height, document.documentElement.clientHeight);
      node.style.height = `${Math.round(visible)}px`;
    };

    apply();
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      node.style.height = '';
    };
  }, [ref, active]);
}

export function VisitorPage({ portalId, resourceId, resourceType }: VisitorPageProps) {
  const [view, setView] = useState<LoadedView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Dish | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeImages, setWelcomeImages] = useState<string[]>([]);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [basketServingOptions, setBasketServingOptions] = useState<Record<string, DishServingOption[]>>({});
  const [addOns, setAddOns] = useState<AddOnOption[]>([]);
  const [overlay, setOverlay] = useState<VisitorOverlay>(null);
  const [editingItem, setEditingItem] = useState<BasketItem | null>(null);
  const [combos, setCombos] = useState<VisitorCombo[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<VisitorCombo | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [basketBadge, setBasketBadge] = useState(false);
  const [chatRestored, setChatRestored] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const scopeRef = useRef<string>('');
  const resetAfterConfirmRef = useRef(false);

  useVisibleHeight(shellRef, Boolean(view));

  // ── Load portal/resource ──
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let loaded: LoadedView | null = null;
        if (resourceId && resourceType) {
          const resource = await getPublicResource(resourceId, resourceType);
          if (!active) return;
          if (!resource) {
            setLoadError('This menu was not found.');
            return;
          }
          loaded = {
            restaurantId: resource.restaurantId,
            name: resource.resourceName || resource.restaurantName,
            restaurantName: resource.restaurantName,
            city: resource.city,
            currency: resource.currency || 'SEK',
            resourceId,
            resourceType,
            chatBackgroundPath: resource.chatBackgroundPath ?? null,
            tableServiceEnabled: resource.tableServiceEnabled,
            tableServiceCharge: resource.tableServiceCharge,
            roomServiceEnabled: resource.roomServiceEnabled,
            roomServiceCharge: resource.roomServiceCharge,
          };
        } else if (portalId) {
          const portal: PublicPortal | null = await getPublicPortal(portalId);
          if (!active) return;
          if (!portal) {
            setLoadError('This menu portal was not found.');
            return;
          }
          loaded = {
            restaurantId: portal.id,
            name: portal.name,
            city: portal.city,
            currency: portal.currency || 'SEK',
          };
        }
        if (loaded) {
          setView(loaded);
          const scope = scopeKey(loaded.restaurantId, loaded.resourceId, loaded.resourceType);
          scopeRef.current = scope;

          // Restore basket from localStorage
          const savedBasket = loadBasket(scope);
          if (savedBasket && savedBasket.length > 0) {
            setBasket(savedBasket);
          }

          // Fetch dish images for the welcome screen background (department/event only)
          if (loaded.resourceId && loaded.resourceType && (loaded.resourceType === 'department' || loaded.resourceType === 'event')) {
            getPublicDishImages(loaded.resourceId, loaded.resourceType)
              .then((urls) => { if (active) setWelcomeImages(urls); })
              .catch(() => { /* welcome screen handles empty images gracefully */ });
            setShowWelcome(true);
          }

          // Restore chat history from localStorage (language is NOT restored)
          const savedChat = loadChatHistory(scope);
          if (savedChat && savedChat.length > 0) {
            transcriptRef.current = savedChat;
            setMessages(savedChat);
            setChatRestored(true);
          }

          // For portal-level QR (no department/event), skip the welcome screen
          // and show the language selector immediately as before.
          if (!loaded.resourceId || (loaded.resourceType !== 'department' && loaded.resourceType !== 'event')) {
            setShowSelector(true);
          }

          // Restore confirmed order reference
          const savedOrder = loadConfirmedOrder(scope);
          if (savedOrder) {
            // Recover order details from server
            try {
              const result = await createOrder({
                idempotencyKey: `recover-${savedOrder.orderId}`,
                restaurantId: loaded.restaurantId,
                resourceId: loaded.resourceId,
                resourceType: loaded.resourceType ?? 'restaurant',
                items: [],
                mobileNumber: '+0',
                paymentMethod: 'pay_to_staff',
              });
            } catch {
              // Recovery attempt with empty items will fail gracefully —
              // the order ref is still stored, we just can't fetch details
              // without a direct query. Keep the ref for display.
            }
          }
        }
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'Could not load this menu.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [portalId, resourceId, resourceType]);

  // ── Persist chat history ──
  useEffect(() => {
    if (!scopeRef.current || messages.length === 0) return;
    saveChatHistory(scopeRef.current, messages);
  }, [messages]);

  // ── Persist basket ──
  useEffect(() => {
    if (!scopeRef.current) return;
    saveBasket(scopeRef.current, basket);
    if (basket.length > 0) setBasketBadge(true);
  }, [basket]);

  // ── Load the restaurant's available Add-on items for the basket selector ──
  const addOnRestaurantId = view?.restaurantId ?? null;
  const addOnResourceType = view?.resourceType ?? 'restaurant';
  const addOnResourceId = view?.resourceId ?? null;
  useEffect(() => {
    if (!addOnRestaurantId) {
      setAddOns([]);
      return;
    }
    let active = true;
    listPublicAddOns(addOnRestaurantId, addOnResourceType, addOnResourceId)
      .then((list) => {
        if (active) setAddOns(list);
      })
      .catch(() => {
        if (active) setAddOns([]);
      });
    return () => {
      active = false;
    };
  }, [addOnRestaurantId, addOnResourceType, addOnResourceId]);

  // ── Load host serving options for basket dishes (drives the Edit size control) ──
  const basketDishKey = Array.from(new Set(basket.filter((item) => !item.comboId).map((item) => item.dishId))).sort().join(',');
  useEffect(() => {
    const dishIds = basketDishKey ? basketDishKey.split(',') : [];
    if (dishIds.length === 0) {
      setBasketServingOptions({});
      return;
    }
    let active = true;
    listServingOptionsByDish(dishIds)
      .then((map) => {
        if (active) setBasketServingOptions(Object.fromEntries(map));
      })
      .catch(() => {
        if (active) setBasketServingOptions({});
      });
    return () => {
      active = false;
    };
  }, [basketDishKey]);

  useEffect(() => {
    if (!view) return;
    let active = true;
    listVisitorCombos(view.restaurantId, view.resourceType ?? 'restaurant', view.resourceId ?? '')
      .then((list) => {
        if (active) setCombos(list);
      })
      .catch(() => {
        if (active) setCombos([]);
      });
    return () => {
      active = false;
    };
  }, [view]);

  // ── Auto-scroll ──
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // ── Basket badge animation ──
  useEffect(() => {
    if (!basketBadge) return;
    const t = window.setTimeout(() => setBasketBadge(false), 1500);
    return () => clearTimeout(t);
  }, [basketBadge]);

  const basketSignature = basket
    .map((i) => `${i.dishId}:${i.servingOptionId ?? ''}:${i.quantity}:${basketLineKey(i)}`)
    .join('|');
  // ── Fetch fresh suggestions when the basket changes ──
  // A basket-aware LLM call (suggestionsOnly mode) returns new suggestion bubbles
  // based on the updated basket + conversation history, without inserting a chat
  // reply or product cards. We skip the initial basket restore and any in-flight
  // normal chat send (which already generates suggestions for this basket state).
  const initialBasketRef = useRef(true);
  const suggestionsReqIdRef = useRef(0);
  useEffect(() => {
    if (initialBasketRef.current) {
      // Skip the first run (initial restore from localStorage or empty basket).
      initialBasketRef.current = false;
      return;
    }
    if (sendingRef.current) {
      // A normal chat send is in flight and will return suggestions itself.
      setSuggestions([]);
      return;
    }
    if (!view || !language || transcriptRef.current.length === 0) {
      setSuggestions([]);
      return;
    }

    const reqId = ++suggestionsReqIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const result = await callFunction<{ suggestions?: string[] }>('visitor-chat', {
          restaurantId: view.restaurantId,
          resourceId: view.resourceId,
          resourceType: view.resourceType,
          message: '',
          suggestionsOnly: true,
          history: toHistory(transcriptRef.current),
          language,
          basket: basket.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            servingLabel: item.servingLabel ?? null,
          })),
        });
        // Stale guard: only apply if no newer request superseded this one.
        if (reqId === suggestionsReqIdRef.current && !sendingRef.current) {
          setSuggestions(Array.isArray(result.suggestions) ? result.suggestions.slice(0, 2) : []);
        }
      } catch {
        if (reqId === suggestionsReqIdRef.current) {
          setSuggestions([]);
        }
      }
    }, 600);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketSignature]);

  async function handleLanguageSelect(lang: string) {
    setLanguage(lang);
    setShowSelector(false);
    // If chat was restored, don't send a duplicate greeting
    if (chatRestored) return;
    void sendGreeting(lang);
  }

  async function sendGreeting(lang: string) {
    if (!view || sendingRef.current) return;
    sendingRef.current = true;
    setSendError(null);
    setSending(true);
    try {
      const result = await callFunction<{ reply: string; dishes: Dish[]; combos?: VisitorCombo[]; followUp: string; suggestions?: string[]; sectionHeadings?: Record<string, string> | null }>('visitor-chat', {
        restaurantId: view.restaurantId,
        resourceId: view.resourceId,
        resourceType: view.resourceType,
        message: 'Please greet me.',
        history: [],
        language: lang,
        basket: basket.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          servingLabel: item.servingLabel ?? null,
        })),
      });
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'bot',
        text: result.reply,
        dishes: result.dishes ?? [],
        combos: result.combos ?? [],
        sectionHeadings: result.sectionHeadings ?? null,
      };
      const newMessages = [...transcriptRef.current, botMessage];
      const followUp = result.followUp?.trim() ?? '';
      if (followUp && (botMessage.dishes.length > 0 || (botMessage.combos ?? []).length > 0)) {
        newMessages.push({
          id: crypto.randomUUID(),
          role: 'bot',
          text: followUp,
          dishes: [],
        });
      }
      transcriptRef.current = newMessages;
      setMessages(newMessages);
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions.slice(0, 2) : []);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'The assistant could not reply.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sendingRef.current || !view) return;
    sendingRef.current = true;
    setSendError(null);
    setInput('');
    setSuggestions([]);
    const history = toHistory(transcriptRef.current);
    const visitorMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'visitor',
      text,
      dishes: [],
    };
    transcriptRef.current = [...transcriptRef.current, visitorMessage];
    setMessages(transcriptRef.current);
    setSending(true);
    try {
      const result = await callFunction<{ reply: string; dishes: Dish[]; combos?: VisitorCombo[]; followUp: string; suggestions?: string[]; sectionHeadings?: Record<string, string> | null }>('visitor-chat', {
        restaurantId: view.restaurantId,
        resourceId: view.resourceId,
        resourceType: view.resourceType,
        message: text,
        history,
        language,
        basket: basket.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          servingLabel: item.servingLabel ?? null,
        })),
      });
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'bot',
        text: result.reply,
        dishes: result.dishes ?? [],
        combos: result.combos ?? [],
        sectionHeadings: result.sectionHeadings ?? null,
      };
      const newMessages = [...transcriptRef.current, botMessage];
      const followUp = result.followUp?.trim() ?? '';
      if (followUp && (botMessage.dishes.length > 0 || (botMessage.combos ?? []).length > 0)) {
        newMessages.push({
          id: crypto.randomUUID(),
          role: 'bot',
          text: followUp,
          dishes: [],
        });
      }
      transcriptRef.current = newMessages;
      setMessages(newMessages);
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions.slice(0, 2) : []);
    } catch (err) {
      transcriptRef.current = transcriptRef.current.filter((item) => item.id !== visitorMessage.id);
      setMessages(transcriptRef.current);
      setInput(text);
      setSendError(err instanceof Error ? err.message : 'The assistant could not reply.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function handleResetChat() {
    // Prevent delayed responses from the previous conversation
    sendingRef.current = false;
    setSending(false);
    setSendError(null);
    // Clear chat state, refs, and localStorage
    transcriptRef.current = [];
    setMessages([]);
    setSuggestions([]);
    setChatRestored(false);
    if (scopeRef.current) clearChatHistory(scopeRef.current);
    // Language is NOT persisted — selector shows again
    setLanguage(null);
    setShowSelector(true);
  }

  function handleAddComboToBasket(combo: VisitorCombo, submission: ComboSubmission) {
    const selections = [...submission.selections].sort(
      (a, b) => a.groupId.localeCompare(b.groupId) || a.dishId.localeCompare(b.dishId),
    );
    const comboKey = basketLineKey({ comboSelections: selections });
    const line = (item: BasketItem) => item.comboId === combo.id && basketLineKey(item) === comboKey;
    setBasket((prev) => {
      if (prev.some(line)) {
        return prev.map((item) => (line(item) ? { ...item, quantity: item.quantity + submission.quantity } : item));
      }
      const newLine: BasketItem = {
        dishId: combo.id,
        name: combo.name,
        price: (submission.unitMinor / 100).toFixed(2),
        imageUrl: combo.imageUrl,
        section: 'combo',
        quantity: submission.quantity,
        servingOptionId: null,
        servingLabel: null,
        removedIngredientIds: [],
        removedIngredientLabels: [],
        additionalRequest: '',
        comboId: combo.id,
        comboSelections: selections,
      };
      return [...prev, newLine];
    });
  }

  function handleAddToBasket(
    dish: Dish,
    quantity: number,
    servingOption?: { id: string; label: string; price: string } | null,
    removedIngredientIds?: string[],
    removedIngredientLabels?: string[],
    additionalRequest?: string,
    variant?: DishVariant | null,
    addOns?: AddOnOption[]
  ) {
    const optionId = servingOption?.id ?? null;
    const optionLabel = servingOption?.label ?? null;
    const optionPrice = servingOption?.price ?? dish.price;
    const selectedAddOns = addOns ?? [];
    const unitPrice = unitPriceWithExtras(optionPrice, variant?.additionalPrice, selectedAddOns);
    const removedIds = removedIngredientIds ?? [];
    const removedLabels = removedIngredientLabels ?? [];
    const request = additionalRequest ?? '';
    const removedKey = basketLineKey({ removedIngredientIds: removedIds, additionalRequest: request, variantId: variant?.id, addOns: selectedAddOns });
    setBasket((prev) => {
      const existing = prev.find(
        (item) =>
          item.dishId === dish.id &&
          (item.servingOptionId ?? null) === optionId &&
          basketLineKey(item) === removedKey
      );
      if (existing) {
        return prev.map((item) =>
          item.dishId === dish.id &&
          (item.servingOptionId ?? null) === optionId &&
          basketLineKey(item) === removedKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          dishId: dish.id,
          name: dish.name,
          price: unitPrice,
          imageUrl: dish.imageUrl,
          quantity,
          section: dish.section,
          servingOptionId: optionId,
          servingLabel: optionLabel,
          removedIngredientIds: removedIds,
          removedIngredientLabels: removedLabels,
          additionalRequest: request,
          variantId: variant?.id,
          variantName: variant?.name,
          variantAdditionalPrice: variant?.additionalPrice,
          addOns: selectedAddOns,
        },
      ];
    });
    setBasketBadge(true);
  }

  function findChatDish(dishId: string): Dish | null {
    for (const message of messages) {
      const match = message.dishes?.find((dish) => dish.id === dishId);
      if (match) return match;
    }
    return null;
  }

  const editingDish = editingItem ? findChatDish(editingItem.dishId) : null;

  function canEditBasketItem(item: BasketItem) {
    return !item.comboId && item.section !== 'add_on' && findChatDish(item.dishId) !== null;
  }

  function handleUpdateBasketLine(original: BasketItem, selection: DishSelection) {
    const optionId = selection.servingOption?.id ?? null;
    const basePrice = selection.servingOption?.price ?? editingDish?.price ?? original.price;
    const unitPrice = unitPriceWithExtras(basePrice, selection.variant?.additionalPrice, selection.addOns);
    const removedKey = basketLineKey({ removedIngredientIds: selection.removedIngredientIds, additionalRequest: selection.additionalRequest, variantId: selection.variant?.id, addOns: selection.addOns });
    setBasket((prev) => {
      if (!prev.includes(original)) return prev;
      const duplicate = prev.find(
        (item) =>
          item !== original &&
          item.dishId === original.dishId &&
          (item.servingOptionId ?? null) === optionId &&
          basketLineKey(item) === removedKey
      );
      if (duplicate) {
        return prev
          .filter((item) => item !== original)
          .map((item) => (item === duplicate ? { ...item, quantity: Math.min(99, item.quantity + selection.quantity) } : item));
      }
      return prev.map((item) =>
        item === original
          ? {
              ...item,
              price: unitPrice,
              quantity: selection.quantity,
              servingOptionId: optionId,
              servingLabel: selection.servingOption?.label ?? null,
              removedIngredientIds: selection.removedIngredientIds,
              removedIngredientLabels: selection.removedIngredientLabels,
              additionalRequest: selection.additionalRequest,
              variantId: selection.variant?.id,
              variantName: selection.variant?.name,
              variantAdditionalPrice: selection.variant?.additionalPrice,
              addOns: selection.addOns,
            }
          : item
      );
    });
  }

  function handleUpdateBasketQuantity(dishId: string, servingOptionId: string | null, quantity: number, removedKey?: string) {
    setBasket((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => !(item.dishId === dishId && (item.servingOptionId ?? null) === servingOptionId && basketLineKey(item) === (removedKey ?? '')));
      }
      return prev.map((item) =>
        item.dishId === dishId && (item.servingOptionId ?? null) === servingOptionId && basketLineKey(item) === (removedKey ?? '')
          ? { ...item, quantity }
          : item
      );
    });
  }

  function handleChangeServingSize(dishId: string, currentOptionId: string | null, removedKey: string, option: DishServingOption) {
    setBasket((prev) => {
      const source = prev.find(
        (item) =>
          item.dishId === dishId &&
          (item.servingOptionId ?? null) === currentOptionId &&
          basketLineKey(item) === removedKey
      );
      if (!source || source.servingOptionId === option.id) return prev;
      const target = prev.find(
        (item) =>
          item !== source &&
          item.dishId === dishId &&
          (item.servingOptionId ?? null) === option.id &&
          basketLineKey(item) === removedKey
      );
      if (target) {
        return prev
          .filter((item) => item !== source)
          .map((item) => (item === target ? { ...item, quantity: Math.min(99, item.quantity + source.quantity) } : item));
      }
      return prev.map((item) =>
        item === source ? { ...item, servingOptionId: option.id, servingLabel: option.label, price: unitPriceWithExtras(option.price, item.variantAdditionalPrice, item.addOns) } : item
      );
    });
  }

  function handleRemoveFromBasket(dishId: string, servingOptionId: string | null, removedKey?: string) {
    setBasket((prev) => prev.filter((item) => !(item.dishId === dishId && (item.servingOptionId ?? null) === servingOptionId && basketLineKey(item) === (removedKey ?? ''))));
  }

  async function handleCheckoutConfirmed(result: ConfirmedOrder) {
    setConfirmedOrder(result);
    setOverlay('confirmation');
    // Re-arm the one-shot auto-reset guard for this confirmation flow
    resetAfterConfirmRef.current = false;
    // Save order ref for recovery
    if (scopeRef.current) {
      saveConfirmedOrder(scopeRef.current, {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      });
    }
    // Clear the basket after successful order
    setBasket([]);
  }

  const basketCount = basket.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
          Loading menu…
        </div>
      </div>
    );
  }

  if (loadError || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-7 text-center shadow-soft ring-1 ring-cream-200">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-olive-600">
            <UtensilsCrossed className="h-6 w-6" />
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">Menu not available</h1>
          <Notice tone="error" className="text-left">
            {loadError ?? 'This menu was not found.'}
          </Notice>
        </div>
      </div>
    );
  }

  const backgroundUrl =
    view?.chatBackgroundPath && !backgroundFailed ? themeAssetUrl(view.chatBackgroundPath) : null;

  return (
    <div
      ref={shellRef}
      className="chat-viewport relative flex flex-col overflow-hidden bg-cream-100"
    >
      {backgroundUrl ? (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <img
            src={backgroundUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setBackgroundFailed(true)}
          />
          <div className="absolute inset-0 bg-cream-100/40" />
        </div>
      ) : null}

      <header
        className="relative z-10 shrink-0 pt-[env(safe-area-inset-top)]"
        style={{ background: 'linear-gradient(90deg, #3F5037 0%, #A4AE91 100%)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3 sm:py-4">
          <img
            src={mascotUrl()}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl object-contain sm:h-12 sm:w-12"
          />
          <div className="min-w-0 flex-1">
            <h1
              className="truncate font-playfair font-bold leading-tight text-white"
              style={{ fontSize: 'clamp(20px, 3.2vw, 24px)' }}
            >
              {view.name || 'Our menu'}
            </h1>
            <p
              className="truncate font-sans font-normal text-white/90"
              style={{ fontSize: 'clamp(12px, 2vw, 14px)' }}
            >
              {view.city ? `${view.city} · Menu assistant` : 'Menu assistant'}
            </p>
          </div>
          {/* Reset chat icon */}
          <button
            type="button"
            onClick={handleResetChat}
            aria-label="Reset chat"
            title="Reset chat"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-all duration-200 hover:bg-white/25"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          {/* Basket icon */}
          <button
            type="button"
            onClick={() => setOverlay('basket')}
            aria-label={`Open basket${basketCount > 0 ? `, ${basketCount} items` : ''}`}
            className={cn(
              'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-all duration-200 hover:bg-white/25',
              basketBadge && 'animate-pop'
            )}
          >
            <ShoppingBag className="h-5 w-5" />
            {basketCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-olive-600 px-1 text-[10px] font-bold text-white ring-2 ring-white/80">
                {basketCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft"
      >
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
          {messages.length === 0 && !showSelector && !sending ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} currency={view.currency} onOpen={setSelected} onOpenCombo={setSelectedCombo} />
          ))}
          {sending ? (
            <div className="flex animate-fade-in justify-start">
              <div className="flex max-w-[92%] items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-soft ring-1 ring-cream-200 sm:max-w-[80%]">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-olive-600" />
                <TypingMessage text={messages.length === 0 ? 'Your AI menu assistant is getting ready' : 'Finding something delicious for you'} />
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <div className="relative z-10 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl px-5 py-3 sm:py-4">
          {sendError ? (
            <Notice tone="error" className="mb-3">
              {sendError}
            </Notice>
          ) : null}
          {suggestions.length > 0 && !sending ? (
            <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.map((text, index) => {
                  const isPrimary = index === 0;
                  return (
                    <button
                      key={text}
                      type="button"
                      onClick={() => void send(text)}
                      disabled={sending}
                      style={
                        isPrimary
                          ? { backgroundColor: '#EB7C10', color: '#FFFFFF' }
                          : { backgroundColor: '#FFF0DF', color: '#A94B0B', border: '1px solid #EB7C10' }
                      }
                      className="group flex animate-bubble-pulse items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold shadow-soft transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-white/90" />
                      <span className="max-w-[20rem] leading-snug line-clamp-2">{text}</span>
                    </button>
                  );
                })}
              </div>
          ) : null}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about a dish, ingredient, or allergy…"
              style={{
                borderRadius: '999px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #E5DED3',
                color: '#292929',
              }}
              className="flex-1 px-5 py-3 text-sm shadow-soft transition-all duration-200 placeholder:text-[#858585] focus:outline-none focus:ring-2 focus:ring-olive-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || !language}
              aria-label="Send"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center text-white shadow-soft transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: '#78866B',
                borderRadius: '20px',
              }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Overlays */}
      {showWelcome && view?.resourceType && (view.resourceType === 'department' || view.resourceType === 'event') ? (
        <WelcomeScreen
          resourceType={view.resourceType}
          resourceName={view.name}
          introduction=""
          images={welcomeImages}
          onContinue={() => {
            setShowWelcome(false);
            setShowSelector(true);
          }}
        />
      ) : null}

      {showSelector ? <LanguageSelector onSelect={handleLanguageSelect} /> : null}

      {overlay === 'combos' ? (
        <ComboListPanel
          combos={combos}
          currency={view.currency}
          onClose={() => setOverlay(null)}
          onSelect={(combo) => {
            setOverlay(null);
            setSelectedCombo(combo);
          }}
        />
      ) : null}

      {selectedCombo ? (
        <ComboDetailPanel
          combo={selectedCombo}
          currency={view.currency}
          onClose={() => setSelectedCombo(null)}
          onAddToBasket={(submission) => handleAddComboToBasket(selectedCombo, submission)}
        />
      ) : null}

      {selected ? (
        <ItemDetailPanel
          dish={selected}
          currency={view.currency}
          addOns={addOns}
          onClose={() => setSelected(null)}
          onAddToBasket={handleAddToBasket}
        />
      ) : null}

      {overlay === 'basket' ? (
        <BasketPanel
          items={basket}
          restaurantName={view.name}
          resourceName={view.resourceId ? view.name : ''}
          currency={view.currency}
          onClose={() => setOverlay(null)}
          onCheckout={() => setOverlay('checkout')}
          servingOptionsByDish={basketServingOptions}
          onUpdateQuantity={handleUpdateBasketQuantity}
          onRemove={handleRemoveFromBasket}
          onChangeServingSize={handleChangeServingSize}
          onEditItem={setEditingItem}
          canEditItem={canEditBasketItem}
        />
      ) : null}

      {editingItem && editingDish ? (
        <ItemDetailPanel
          dish={editingDish}
          currency={view.currency}
          addOns={addOns}
          onClose={() => setEditingItem(null)}
          editing={{
            initial: {
              servingOption: editingDish.servingOptions?.find((o) => o.id === editingItem.servingOptionId) ?? null,
              variant: editingDish.variants.find((v) => v.id === editingItem.variantId) ?? null,
              quantity: editingItem.quantity,
              removedIngredientIds: editingItem.removedIngredientIds ?? [],
              removedIngredientLabels: editingItem.removedIngredientLabels ?? [],
              additionalRequest: editingItem.additionalRequest ?? '',
              addOns: editingItem.addOns ?? [],
            },
            onUpdate: (selection) => handleUpdateBasketLine(editingItem, selection),
          }}
        />
      ) : null}

      {overlay === 'checkout' ? (
        <CheckoutView
          items={basket}
          restaurantName={view.name}
          restaurantId={view.restaurantId}
          resourceName={view.resourceId ? view.name : ''}
          resourceId={view.resourceId}
          resourceType={view.resourceType}
          currency={view.currency}
          tableServiceEnabled={view.tableServiceEnabled}
          tableServiceCharge={view.tableServiceCharge}
          roomServiceEnabled={view.roomServiceEnabled}
          roomServiceCharge={view.roomServiceCharge}
          onBack={() => setOverlay('basket')}
          onConfirmed={handleCheckoutConfirmed}
        />
      ) : null}

      {overlay === 'confirmation' && confirmedOrder ? (
        <OrderConfirmation
          order={confirmedOrder}
          onClose={() => {
            setOverlay(null);
            setConfirmedOrder(null);
            if (!resetAfterConfirmRef.current) {
              resetAfterConfirmRef.current = true;
              handleResetChat();
            }
          }}
        />
      ) : null}
    </div>
  );
}

const CARD_REVEAL_DELAY_MS = 250;

function TypingDots() {
  return (
    <span className="inline-flex" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block animate-typing-dot"
          style={{ animationDelay: `${i * 0.3}s` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

function TypingMessage({ text }: { text: string }) {
  return <span className="italic text-ink-muted">{text}<TypingDots /></span>;
}

function MessageBubble({
  message,
  currency,
  onOpen,
  onOpenCombo,
}: {
  message: ChatMessage;
  currency: string;
  onOpen: (dish: Dish) => void;
  onOpenCombo: (combo: VisitorCombo) => void;
}) {
  const isVisitor = message.role === 'visitor';
  const [revealed, setRevealed] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    const total = message.dishes.length + (message.combos ?? []).length;
    if (total <= 1) {
      setRevealed(total);
      return;
    }
    setRevealed(1);
    for (let i = 1; i < total; i++) {
      const t = window.setTimeout(() => {
        setRevealed(i + 1);
        timersRef.current = timersRef.current.filter((x) => x !== t);
      }, i * CARD_REVEAL_DELAY_MS);
      timersRef.current.push(t);
    }
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [message.id, message.dishes.length, message.combos?.length]);

  const combos = message.combos ?? [];

  // Cards are grouped by their saved menu section, preserving the order the
  // backend returned. A heading is rendered only when its group has cards.
  const sectionHeadings = message.sectionHeadings ?? null;
  const groups: { key: string; label: string; start: number; cards: React.ReactNode[] }[] = [];
  let lastKey: string | null = null;
  let cardIndex = 0;
  for (const dish of message.dishes) {
    const key = dish.section ?? 'food';
    if (key !== lastKey) {
      groups.push({ key, label: sectionHeadings?.[key] || sectionLabel(key), start: cardIndex, cards: [] });
      lastKey = key;
    }
    groups[groups.length - 1].cards.push(
      <DishResult key={`dish-${dish.id}`} dish={dish} currency={currency} onOpen={() => onOpen(dish)} />
    );
    cardIndex += 1;
  }
  if (combos.length > 0) {
    groups.push({
      key: 'combos',
      label: sectionHeadings?.combos || 'Combos',
      start: cardIndex,
      cards: combos.map((combo) => (
        <ComboResult key={`combo-${combo.id}`} combo={combo} currency={currency} onOpen={() => onOpenCombo(combo)} />
      )),
    });
  }

  return (
    <div className={cn('flex animate-fade-in', isVisitor ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[92%] space-y-3 sm:max-w-[80%]')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft',
            isVisitor
              ? 'bg-olive-700 text-white'
              : 'bg-white text-ink ring-1 ring-cream-200'
          )}
        >
          {isVisitor ? message.text : <AssistantMarkdown text={message.text} />}
        </div>
        {groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map((group) => {
              if (group.start >= revealed) return null;
              return (
                <div key={`group-${group.key}`} className="space-y-3">
                  <CardSectionHeading label={group.label} />
                  {group.cards.slice(0, revealed - group.start)}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardSectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2" role="presentation">
      <span className="h-px flex-1 bg-white/80" />
      <span
        className="rounded-full px-4 py-2 text-[0.8125rem] font-bold shadow-soft"
        style={{ backgroundColor: '#EB7C10', color: '#FFFFFF' }}
      >
        {label}
      </span>
      <span className="h-px flex-1 bg-white/80" />
    </div>
  );
}

function DishResult({ dish, currency, onOpen }: { dish: Dish; currency: string; onOpen: () => void }) {
  const cur = normalizeCurrency(currency);
  const activeOptions = (dish.servingOptions ?? []).filter((o) => o.isActive !== false);
  const hasMultiplePrices = activeOptions.length > 1;
  return (
    <ChatCardButton
      name={dish.name}
      description={dish.description}
      imageUrl={dish.imageUrl}
      allergy={dish.allergy}
      price={dish.price && !hasMultiplePrices ? formatPriceInput(dish.price, cur) : null}
      priceOptions={hasMultiplePrices ? activeOptions.map((o) => formatPriceInput(o.price, cur)) : []}
      ariaLabel={`View details for ${dish.name || 'this item'}`}
      onOpen={onOpen}
    />
  );
}

function ComboResult({ combo, currency, onOpen }: { combo: VisitorCombo; currency: string; onOpen: () => void }) {
  const cur = normalizeCurrency(currency);
  return (
    <ChatCardButton
      name={combo.name}
      description={combo.description}
      imageUrl={combo.imageUrl}
      badge="Combo"
      price={combo.price ? formatPriceInput(combo.price, cur) : null}
      priceOptions={[]}
      ariaLabel={`Build combo ${combo.name || ''}`.trim()}
      onOpen={onOpen}
    />
  );
}
