import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface IncomingItem {
  dishId: string;
  quantity: number;
  servingOptionId?: string | null;
  removedIngredientIds?: string[];
}

interface OrderPayload {
  action: 'create' | 'status';
  idempotencyKey: string;
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

/**
 * Parses a price text like "120 SEK", "150,00 kr", "$15.50", "95.00" into
 * integer minor units. Strips all non-numeric characters except dots and
 * commas, normalises European decimal commas to dots, then rounds to the
 * nearest integer (minor unit = 1/100 of major).
 * Returns null if the string has no parseable number.
 */
function parsePriceMinor(priceText: string): number | null {
  if (!priceText || typeof priceText !== 'string') return null;
  let s = priceText.trim();
  if (!s) return null;

  // Remove everything except digits, dots, commas
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return null;

  // Handle European format: "150,00" or "1.234,50"
  // If there's a comma followed by exactly 2 digits at the end and no dot
  // after it, treat comma as decimal separator.
  const commaIdx = s.lastIndexOf(',');
  const dotIdx = s.lastIndexOf('.');
  if (commaIdx > dotIdx) {
    // Comma is the decimal separator — remove all dots (thousands), replace comma with dot
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dotIdx >= 0 && commaIdx >= 0 && commaIdx < dotIdx) {
    // Dot is decimal, commas are thousands separators
    s = s.replace(/,/g, '');
  } else if (commaIdx >= 0 && dotIdx < 0) {
    // Only comma — could be decimal or thousands
    const afterComma = s.length - commaIdx - 1;
    if (afterComma <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

interface DishRow {
  id: string;
  name: string;
  price: string;
  available: boolean;
  restaurant_id: string;
}

interface ServingOptionRow {
  id: string;
  dish_id: string;
  label: string;
  price: string;
  is_active: boolean;
}

interface RemovableIngredientRow {
  id: string;
  dish_id: string;
  label: string;
  is_active: boolean;
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

      // Validate quantities
      for (const item of items) {
        if (!item.dishId || typeof item.dishId !== 'string') {
          return json({ error: 'Invalid item in basket.' }, 400);
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
          return json({ error: 'Invalid quantity for an item.' }, 400);
        }
      }

      // ── Idempotency check: if an order already exists with this key, return it ──
      const { data: existing } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total_minor, currency, item_count, created_at, restaurant_name, resource_name, resource_type, mobile_number')
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
      const dishIds = items.map((i) => i.dishId);
      const { data: dishes, error: dishError } = await supabase
        .from('dishes')
        .select('id, name, price, available, restaurant_id')
        .in('id', dishIds);

      if (dishError) throw dishError;
      if (!dishes || dishes.length !== dishIds.length) {
        return json({ error: 'One or more items could not be found. Please review your basket.' }, 400);
      }

      const dishMap = new Map<string, DishRow>();
      for (const d of dishes as DishRow[]) {
        if (d.restaurant_id !== restaurantId) {
          return json({ error: 'One or more items do not belong to this restaurant.' }, 400);
        }
        if (!d.available) {
          return json({ error: `"${d.name}" is no longer available. Please review your basket.` }, 400);
        }
        dishMap.set(d.id, d);
      }

      // ── Fetch serving options for dishes that reference them ──
      const optionIds = items.filter((i) => i.servingOptionId).map((i) => i.servingOptionId!) as string[];
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
      const allRemovedIds = items.flatMap((i) => i.removedIngredientIds ?? []);
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
        dish_id: string;
        name: string;
        price_minor: number;
        quantity: number;
        line_total_minor: number;
      }[] = [];

      for (const item of items) {
        const dish = dishMap.get(item.dishId);
        if (!dish) {
          return json({ error: 'Invalid item in basket.' }, 400);
        }

        let priceMinor: number | null;
        let servingLabel: string | null = null;
        let servingOptionId: string | null = null;
        let removedIngredientsText = '';

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
        });
      }

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
          payment_status: 'test_unpaid',
          total_minor: totalMinor,
          currency: orderCurrency,
          idempotency_key: idempotencyKey,
          item_count: itemCount,
          mobile_number: mobileNumber,
        })
        .select('id, order_number, status, payment_status, total_minor, currency, item_count, created_at, restaurant_name, resource_name, resource_type, mobile_number')
        .single();

      if (orderError) {
        // If it's a unique constraint violation on idempotency_key, a duplicate
        // request raced us — re-query and return the existing order.
        if (orderError.code === '23505') {
          const { data: raced } = await supabase
            .from('orders')
            .select('id, order_number, status, payment_status, total_minor, currency, item_count, created_at, restaurant_name, resource_name, resource_type, mobile_number')
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
        name: i.name,
        price_minor: i.price_minor,
        quantity: i.quantity,
        line_total_minor: i.line_total_minor,
        serving_option_id: i.serving_option_id ?? null,
        serving_label: i.serving_label ?? null,
        removed_ingredients: i.removed_ingredients,
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
