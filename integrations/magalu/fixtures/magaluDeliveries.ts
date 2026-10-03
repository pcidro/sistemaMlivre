import type { MagaluDeliveryDetails } from "../magaluDelivery.types";

export const deliveryOrderCode = "0000000000000001";
// Canal fictício vindo de uma resposta mockada; nunca usado como configuração.
export const fixtureProductionChannelId = "00000000-0000-4000-8000-000000000020";

export function deliveryFixture(id: string, channelId: string): MagaluDeliveryDetails {
  return {
    id,
    code: `${deliveryOrderCode}-1`,
    status: "invoiced",
    order: { code: deliveryOrderCode, channel: { id: channelId } },
  };
}
