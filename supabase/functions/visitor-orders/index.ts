import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import {
  MAX_REQUEST_CHARS,
  MAX_REQUEST_WORDS,
  parsePriceMinor,
  type DishRow,
  type RemovableIngredientRow,
  type ServingOptionRow,
  type VariantRow,
} from './pricing.ts';
import {
  listCombosForScope,
  priceComboLine,
  type ComboGroupRow,
  type ComboRow,
  type ComboSelectionInput,
  type ComboSelectionSnapshot,
  type ResourceScope,
} from './combo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface IncomingItem {
  dishId?: string;
  comboId?: string;
  quantity: number;
  servingOptionId?: string | null;
  variantId?: string | null;
  additionalRequest?: string;
  selections?: ComboSelectionInput[];
}

interface TipInput {
  option?: string;
  customMinor?: number;
}

interface OrderPayload {
  action: 'create' | 'status';
  idempotencyKey: string;
  tip?: TipInput;
  restaurantId: string;
  resourceId?: string;
  resourceType?: string;
  items?: IncomingItem[];
  orderId?: string;
  newStatus?: string;
  mobileNumber?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TIP_PERCENTS = new Map<string, number>([['5', 5], ['10', 10], ['13', 13], ['20', 20]]);
const MAX_CUSTOM_TIP_MINOR = 1_000_000;

function resolveTip(
  tip: TipInput | undefined,
  subtotalMinor: number,
): { tipOption: string; tipMinor: number } | { error: string } {
  const option = tip?.option ?? 'none';
  if (option === 'none') return { tipOption: 'none', tipMinor: 0 };
  const percent = TIP_PERCENTS.get(option);
  if (percent !== undefined) {
    return { tipOption: option, tipMinor: Math.round((subtotalMinor * percent) / 100) };
  }
  if (option === 'custom') {
    const amount = tip?.customMinor;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > MAX_CUSTOM_TIP_MINOR) {
      return { error: 'Please enter a valid tip amount.' };
    }
    return { tipOption: 'custom', tipMinor: amount };
  }
  return { error: 'Invalid tip option.' };
}

interface ResourceRow {
  resource_name: string;
  resource_type: string;
  restaurant_name: string;
  restaurant_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => null)) as OrderPayload | null;
    if (!body) return json({ error: 'Invalid request body.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ─── Action: create order ───
    if (body.action === 'create') {
      const { idempotencyKey, restaurantId, items } = body;

      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return json({ error: 'Missing idempotency key.' }, 400);
      }
      if (!restaurantId) return json({ error: 'Missing restaurant.' }, 400);
      if (!items || !Array.isArray(items) || items.length === 0) {
        return json({ error: 'Your basket is empty.' }, 400);
      }
      if (items.length > 100) {
        return json({ error: 'Too many items in the basket.' }, 400);
      }

      // ── Validate mobile number (E.164 format required) ──
      const mobileNumber = body.mobileNumber;
      if (!mobileNumber || typeof mobileNumber !== 'string') {
        return json({ error: 'A mobile number is required to place an order.' }, 400);
      }
      if (!/^\+[1-9][0-9]{5,14}$/.test(mobileNumber)) {
        return json({ error: 'Please enter a valid mobile number in international format.' }, 400);
      }

      if (body.paymentMethod !== 'pay_to_staff' && body.paymentMethod !== 'pay_online') {
        return json({ error: 'Please choose a payment method.' }, 400);
      }
      const paymentStatus = body.paymentMethod === 'pay_to_staff' ? 'pay_to_staff' : 'test_unpaid';

      // Validate quantities
      for (const item of items) {
        if (item.comboId !== undefined) {
          if (typeof item.comboId !== 'string' || !Array.isArray(item.selections) || item.selections.length > 50) {
            return json({ error: 'Invalid combo in basket.' }, 400);
          }
        } else if (!item.dishId || typeof item.dishId !== 'string') {
          return json({ error: 'Invalid item in basket.' }, 400);
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
          return json({ error: 'Invalid quantity for an item.' }, 400);
        }
      }

      // ── Idempotency check: if an order already exists with this key, return it ──
      const { data: existing } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total_minor, subtotal_minor, tip_option, tip_minor, currency, item_count, created_at, restaurant_name, resource_name, resource_type, mobile_number')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        // Return the existing order with its items
        const { data: existingItems } = await supabase
          .from('order_items')
          .select('name, price_minor, quantity, line_total_minor')
          .eq('order_id', existing.id)
          .order('created_at', { ascending: true });

        return json({
          orderId: existing.id,
          orderNumber: existing.order_number,
          status: existing.status,
          paymentStatus: existing.payment_status,
          totalMinor: existing.total_minor,
          subtotalMinor: existing.subtotal_minor,
          tipOption: existing.tip_option,
          tipMinor: existing.tip_minor,
          currency: existing.currency,
          itemCount: existing.item_count,
          createdAt: existing.created_at,
          restaurantName: existing.restaurant_name,
          resourceName: existing.resource_name,
          resourceType: existing.resource_type,
          mobileNumber: existing.mobile_number ?? mobileNumber!,
          items: (existingItems ?? []).map((i: { name: string; price_minor: number; quantity: number; line_total_minor: number }) => ({
            name: i.name,
            priceMinor: i.price_minor,
            quantity: i.quantity,
            lineTotalMinor: i.line_total_minor,
          })),
          idempotent: true,
        });
      }

      // ── Verify restaurant exists and is Active ──
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, status, currency')
        .eq('id', restaurantId)
        .maybeSingle();

      if (restError) throw restError;
      if (!restaurant || restaurant.status !== 'Active') {
        return json({ error: 'This restaurant is not available.' }, 400);
      }

      const orderCurrency = restaurant.currency ?? 'SEK';

      // ── Resolve resource and validate ──
      const resourceType = body.resourceType ?? 'restaurant';
      const resourceId = body.resourceId ?? restaurantId;
      let resourceName = restaurant.name;
      let departmentId: string | null = null;
      let eventId: string | null = null;

      if (resourceType === 'department' && resourceId) {
        const { data: dept } = await supabase
          .from('departments')
          .select('id, name, restaurant_id, is_active')
          .eq('id', resourceId)
          .maybeSingle();
        if (!dept || dept.restaurant_id !== restaurantId) {
          return json({ error: 'Invalid department for this restaurant.' }, 400);
        }
        if (!dept.is_active) {
          return json({ error: 'This department is not currently active.' }, 400);
        }
        resourceName = dept.name;
        departmentId = dept.id;
      } else if (resourceType === 'event' && resourceId) {
        const { data: evt } = await supabase
          .from('events')
          .select('id, name, restaurant_id, status')
          .eq('id', resourceId)
          .maybeSingle();
        if (!evt || evt.restaurant_id !== restaurantId) {
          return json({ error: 'Invalid event for this restaurant.' }, 400);
        }
        if (evt.status === 'archived') {
          return json({ error: 'This event is no longer available.' }, 400);
        }
        resourceName = evt.name;
        eventId = evt.id;
      } else if (resourceType !== 'restaurant') {
        return json({ error: 'Invalid resource type.' }, 400);
      }

      // ── Validate all dish IDs belong to this restaurant ──
      const dishIds = [...new Set([
        ...items.filter((i) => i.dishId).map((i) => i.dishId!),
        ...items.flatMap((i) => (i.selections ?? []).map((s) => s.dishId)),
      ])];
      let dishes: DishRow[] = [];
      if (dishIds.length > 0) {
        const { data, error: dishError } = await supabase
          .from('dishes')
          .select('id, name, price, available, restaurant_id, section, category, department_id, event_id')
          .in('id', dishIds);
        if (dishError) throw dishError;
        dishes = (data ?? []) as DishRow[];
      }
      if (dishes.length !== dishIds.length) {
        return json({ error: 'One or more items could not be found. Please review your basket.' }, 400);
      }

      const comboIds = [...new Set(items.filter((i) => i.comboId).map((i) => i.comboId!))];
      const comboMap = new Map<string, ComboRow>();
      const groupsByCombo = new Map<string, ComboGroupRow[]>();
      if (comboIds.length > 0) {
        const { data: combos, error: comboError } = await supabase
          .from('combos')
          .select('id, restaurant_id, department_id, event_id, name, price, is_active')
          .in('id', comboIds);
        if (comboError) throw comboError;
        for (const c of (combos ?? []) as ComboRow[]) comboMap.set(c.id, c);

        const { data: groups, error: groupError } = await supabase
          .from('combo_groups')
          .select('id, combo_id, section, category, required_count, sort_order')
          .in('combo_id', comboIds);
        if (groupError) throw groupError;
        for (const g of (groups ?? []) as ComboGroupRow[]) {
          const list = groupsByCombo.get(g.combo_id) ?? [];
          list.push(g);
          groupsByCombo.set(g.combo_id, list);
        }
      }

      const dishMap = new Map<string, DishRow>();
      for (const d of dishes) {
        if (d.restaurant_id !== restaurantId) {
          return json({ error: 'One or more items do not belong to this restaurant.' }, 400);
        }
        if (!d.available) {
          return json({ error: `"${d.name}" is no longer available. Please review your basket.` }, 400);
        }
        dishMap.set(d.id, d);
      }

      // ── Fetch serving options for dishes that reference them ──
      const optionIds = [...new Set([
        ...items.filter((i) => i.servingOptionId).map((i) => i.servingOptionId!),
        ...items.flatMap((i) => (i.selections ?? []).filter((s) => s.servingOptionId).map((s) => s.servingOptionId!)),
      ])];
      const optionMap = new Map<string, ServingOptionRow>();
      if (optionIds.length > 0) {
        const { data: options, error: optError } = await supabase
          .from('dish_serving_options')
          .select('id, dish_id, label, price, is_active')
          .in('id', optionIds);
        if (optError) throw optError;
        for (const opt of (options ?? []) as ServingOptionRow[]) {
          optionMap.set(opt.id, opt);
        }
      }

      // ── Fetch removable ingredients for dishes that reference them ──
      const allRemovedIds = [...new Set(items.flatMap((i) => [
        ...(i.removedIngredientIds ?? []),
        ...(i.selections ?? []).flatMap((s) => s.removedIngredientIds ?? []),
      ]))];
      const variantMap = new Map<string, VariantRow>();
      const variantsByDish = new Map<string, VariantRow[]>();
      if (dishIds.length > 0) {
        const { data: variants, error: variantError } = await supabase
          .from('dish_variants')
          .select('id, dish_id, name, additional_price, is_active')
          .in('dish_id', dishIds);
        if (variantError) throw variantError;
        for (const v of (variants ?? []) as VariantRow[]) {
          variantMap.set(v.id, v);
          const list = variantsByDish.get(v.dish_id) ?? [];
          list.push(v);
          variantsByDish.set(v.dish_id, list);
        }
      }

      const ingredientMap = new Map<string, RemovableIngredientRow>();
      if (allRemovedIds.length > 0) {
        const { data: ingredients, error: ingError } = await supabase
          .from('dish_removable_ingredients')
          .select('id, dish_id, label, is_active')
          .in('id', allRemovedIds);
        if (ingError) throw ingError;
        for (const ing of (ingredients ?? []) as RemovableIngredientRow[]) {
          ingredientMap.set(ing.id, ing);
        }
      }

      // ── Server-side price calculation ──
      let totalMinor = 0;
      let itemCount = 0;
      const orderItems: {
        dish_id: string | null;
        combo_id?: string;
        selections?: ComboSelectionSnapshot[];
        name: string;
        price_minor: number;
        quantity: number;
        line_total_minor: number;
        serving_option_id: string | null;
        serving_label: string | null;
        removed_ingredients: string;
        additional_request: string;
        variant_id?: string | null;
        variant_name?: string | null;
        variant_additional_minor?: number | null;
      }[] = [];

      for (const item of items) {
        if (item.comboId) {
          const combo = comboMap.get(item.comboId);
          if (!combo) {
            return json({ error: 'One of the combos in your basket is no longer available. Please review your basket.' }, 400);
          }
          for (const selection of item.selections ?? []) {
            if ((variantsByDish.get(selection.dishId) ?? []).some((v) => v.is_active)) {
              return json({ error: 'A dish with options cannot be added to a combo yet. Please review your basket.' }, 400);
            }
          }
          const pricing = priceComboLine({
            combo,
            groups: groupsByCombo.get(combo.id) ?? [],
            selections: item.selections ?? [],
            additionalRequest: item.additionalRequest,
            dishes: dishMap,
            options: optionMap,
            ingredients: ingredientMap,
            scope: { departmentId, eventId } satisfies ResourceScope,
          });
          if (!pricing.ok) return json({ error: pricing.error }, 400);
          const comboLineTotal = pricing.unitMinor * item.quantity;
          totalMinor += comboLineTotal;
          itemCount += item.quantity;
          orderItems.push({
            dish_id: null,
            combo_id: combo.id,
            name: combo.name,
            price_minor: pricing.unitMinor,
            quantity: item.quantity,
            line_total_minor: comboLineTotal,
            serving_option_id: null,
            serving_label: null,
            removed_ingredients: '',
            additional_request: pricing.additionalRequest,
            selections: pricing.selections,
          });
          continue;
        }

        const dish = item.dishId ? dishMap.get(item.dishId) : undefined;
        if (!dish) {
          return json({ error: 'Invalid item in basket.' }, 400);
        }

        let priceMinor: number | null;
        let servingLabel: string | null = null;
        let servingOptionId: string | null = null;
        let removedIngredientsText = '';
        let additionalRequest = '';

        if (item.servingOptionId) {
          const opt = optionMap.get(item.servingOptionId);
          if (!opt) {
            return json({ error: `The selected serving option for "${dish.name}" is no longer available.` }, 400);
          }
          if (opt.dish_id !== item.dishId) {
            return json({ error: 'Invalid serving option for this item.' }, 400);
          }
          if (!opt.is_active) {
            return json({ error: `The serving option "${opt.label}" for "${dish.name}" is no longer available.` }, 400);
          }
          priceMinor = parsePriceMinor(opt.price);
          servingLabel = opt.label;
          servingOptionId = opt.id;
        } else {
          priceMinor = parsePriceMinor(dish.price);
        }

        const dishVariants = (variantsByDish.get(dish.id) ?? []).filter((v) => v.is_active);
        let selectedVariant: VariantRow | null = null;
        let variantAdditionalMinor: number | null = null;
        if (dishVariants.length > 0 || item.variantId) {
          if (!item.variantId) {
            return json({ error: `Please choose an option for "${dish.name}".` }, 400);
          }
          const variant = variantMap.get(item.variantId);
          if (!variant || variant.dish_id !== dish.id) {
            return json({ error: `The selected option for "${dish.name}" is not valid. Please review your basket.` }, 400);
          }
          if (!variant.is_active) {
            return json({ error: `The option "${variant.name}" for "${dish.name}" is no longer available.` }, 400);
          }
          const extraMinor = parsePriceMinor(variant.additional_price);
          if (extraMinor === null) {
            return json({ error: `The price for the option "${variant.name}" is not valid.` }, 400);
          }
          selectedVariant = variant;
          variantAdditionalMinor = extraMinor;
          if (priceMinor !== null) priceMinor += extraMinor;
        }

        // ── Validate removable ingredient IDs ──
        const removedIds = item.removedIngredientIds ?? [];
        if (removedIds.length > 0) {
          const validatedLabels: string[] = [];
          for (const ingId of removedIds) {
            const ing = ingredientMap.get(ingId);
            if (!ing) {
              return json({ error: `One of the selected removals for "${dish.name}" is no longer available.` }, 400);
            }
            if (ing.dish_id !== item.dishId) {
              return json({ error: 'Invalid removable ingredient for this item.' }, 400);
            }
            if (!ing.is_active) {
              return json({ error: `The removal option "${ing.label}" for "${dish.name}" is no longer available.` }, 400);
            }
            validatedLabels.push(`no ${ing.label}`);
          }
          removedIngredientsText = validatedLabels.join(', ');
        }

        if (item.additionalRequest !== undefined && item.additionalRequest !== null) {
          if (typeof item.additionalRequest !== 'string') {
            return json({ error: 'Invalid request for an item.' }, 400);
          }
          additionalRequest = item.additionalRequest.trim();
          if (additionalRequest.length > MAX_REQUEST_CHARS || additionalRequest.split(/\s+/).filter(Boolean).length > MAX_REQUEST_WORDS) {
            return json({ error: `The request for "${dish.name}" can be at most ${MAX_REQUEST_WORDS} words.` }, 400);
          }
        }

        if (priceMinor === null) {
          return json({ error: `Could not determine the price for "${dish.name}".` }, 400);
        }
        const lineTotal = priceMinor * item.quantity;
        totalMinor += lineTotal;
        itemCount += item.quantity;
        orderItems.push({
          dish_id: dish.id,
          name: dish.name,
          price_minor: priceMinor,
          quantity: item.quantity,
          line_total_minor: lineTotal,
          serving_option_id: servingOptionId,
          serving_label: servingLabel,
          removed_ingredients: removedIngredientsText,
          additional_request: additionalRequest,
          variant_id: selectedVariant?.id ?? null,
          variant_name: selectedVariant?.name ?? null,
          variant_additional_minor: variantAdditionalMinor,
        });
      }

      const tipResult = resolveTip(body.tip, totalMinor);
      if ('error' in tipResult) {
        return json({ error: tipResult.error }, 400);
      }
      const subtotalMinor = totalMinor;

      // ── Generate unique order number ──
      let orderNumber = '';
      let attempts = 0;
      while (attempts < 5) {
        const candidate = await supabase.rpc('generate_order_number');
        if (candidate.error) throw candidate.error;
        orderNumber = candidate.data as string;
        const { data: conflict } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', orderNumber)
          .maybeSingle();
        if (!conflict) break;
        attempts++;
      }
      if (!orderNumber) {
        return json({ error: 'Could not generate a unique order number. Please try again.' }, 500);
      }

      // ── Insert order ──
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          restaurant_id: restaurantId,
          department_id: departmentId,
          event_id: eventId,
          resource_type: resourceType,
          resource_name: resourceName,
          restaurant_name: restaurant.name,
          status: 'new',
          payment_status: paymentStatus,
          subtotal_minor: subtotalMinor,
          tip_option: tipResult.tipOption,
          tip_minor: tipResult.tipMinor,
          total_minor: subtotalMinor + tipResult.tipMinor,
          currency: orderCurrency,
          idempotency_key: idempotencyKey,
          item_count: itemCount,
          mobile_number: mobileNumber,
        })
        .select('id, order_number, status, payment_status, total_minor, subtotal_minor, tip_option, tip_minor, currency, item_count, created_at, restaurant_name, resource_name, resource_type, mobile_number')
        .single();

      if (orderError) {
        // If it's a unique constraint violation on idempotency_key, a duplicate
        // request raced us — re-query and return the existing order.
        if (orderError.code === '23505') {
          const { data: raced } = await supabase
            .from('orders')
            .select('id, order_number, status, payment_status, total_minor, subtotal_minor, tip_option, tip_minor, currency, item_count, created_at, restaurant_name, resource_name, resource_type, mobile_number')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();
          if (raced) {
            const { data: racedItems } = await supabase
              .from('order_items')
              .select('name, price_minor, quantity, line_total_minor')
              .eq('order_id', raced.id);
            return json({
              orderId: raced.id,
              orderNumber: raced.order_number,
              status: raced.status,
              paymentStatus: raced.payment_status,
              totalMinor: raced.total_minor,
              subtotalMinor: raced.subtotal_minor,
              tipOption: raced.tip_option,
              tipMinor: raced.tip_minor,
              currency: raced.currency,
              itemCount: raced.item_count,
              createdAt: raced.created_at,
              restaurantName: raced.restaurant_name,
              resourceName: raced.resource_name,
              resourceType: raced.resource_type,
              mobileNumber: raced.mobile_number ?? mobileNumber!,
              items: (racedItems ?? []).map((i: { name: string; price_minor: number; quantity: number; line_total_minor: number }) => ({
                name: i.name,
                priceMinor: i.price_minor,
                quantity: i.quantity,
                lineTotalMinor: i.line_total_minor,
              })),
              idempotent: true,
            });
          }
        }
        throw orderError;
      }

      // ── Insert order items ──
      const itemsToInsert = orderItems.map((i) => ({
        order_id: order!.id,
        dish_id: i.dish_id,
        combo_id: i.combo_id ?? null,
        selections: i.selections ?? null,
        name: i.name,
        price_minor: i.price_minor,
        quantity: i.quantity,
        line_total_minor: i.line_total_minor,
        serving_option_id: i.serving_option_id ?? null,
        serving_label: i.serving_label ?? null,
        removed_ingredients: i.removed_ingredients,
        additional_request: i.additional_request,
        variant_id: i.variant_id ?? null,
        variant_name: i.variant_name ?? null,
        variant_additional_minor: i.variant_additional_minor ?? null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // ── Log initial status ──
      await supabase
        .from('order_status_log')
        .insert({
          order_id: order!.id,
          from_status: null,
          to_status: 'new',
          changed_by: null,
        });

      return json({
        orderId: order!.id,
        orderNumber: order!.order_number,
        status: order!.status,
        paymentStatus: order!.payment_status,
        totalMinor: order!.total_minor,
        subtotalMinor: order!.subtotal_minor,
        tipOption: order!.tip_option,
        tipMinor: order!.tip_minor,
        currency: order!.currency,
        itemCount: order!.item_count,
        createdAt: order!.created_at,
        restaurantName: order!.restaurant_name,
        resourceName: order!.resource_name,
        resourceType: order!.resource_type,
        mobileNumber: order!.mobile_number ?? mobileNumber!,
        items: orderItems.map((i) => ({
          name: i.name,
          priceMinor: i.price_minor,
          quantity: i.quantity,
          lineTotalMinor: i.line_total_minor,
        })),
        idempotent: false,
      });
    }

    // ─── Action: list combos for a visitor resource ───
    if (body.action === 'combos') {
      if (!body.restaurantId) return json({ error: 'Missing restaurant.' }, 400);
      const scope: ResourceScope = {
        departmentId: body.resourceType === 'department' ? body.resourceId ?? null : null,
        eventId: body.resourceType === 'event' ? body.resourceId ?? null : null,
      };
      const combos = await listCombosForScope(supabase, body.restaurantId, scope);
      return json({ combos });
    }

    // ─── Action: update status (host) ───
    if (body.action === 'status') {
      const { orderId, newStatus } = body;
      if (!orderId || !newStatus) {
        return json({ error: 'Missing order ID or status.' }, 400);
      }

      const { data, error } = await supabase.rpc('update_order_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
      });

      if (error) {
        return json({ error: error.message }, 400);
      }

      return json({ success: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'An unexpected error occurred.' }, 500);
  }
});
