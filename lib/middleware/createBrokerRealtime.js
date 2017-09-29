import { buildLimitOrder } from '../util/orders'
import {
  ORDER_REQUESTED,
  ORDER_CREATED,
  ORDER_PLACED,
  ORDER_FILLED,
  ORDER_FAILED,
  ORDER_CANCELLED
} from '../constants'

/**
 * Creates a broker middleware to be used running backtests.
 * In contrast to the backtest broker middleware, this middleware builds an order, then dispatches
 * the built order for the next round-trip. When the built order arrives back at this middleware,
 * it is executed synchronously.
 * 
 * @param  {function} createClient Factory function for building the client to be used when sending
 *                                 requests to an _actual_ broker.
 * @return {function} Middleware
 */
export default function createBrokerRealtime(createClient) {
  return (store) => {

    const client = createClient({
      onFill: order => store.dispatch({ type: ORDER_FILLED, payload: order }),
      onFail: order => store.dispatch({ type: ORDER_FAILED, payload: order }),
      onCancel: order => store.dispatch({ type: ORDER_CANCELLED, payload: order })
    })

    return (next) => async (action) => {
      switch (action.type) {
      case ORDER_REQUESTED: {
        // TODO: Check that we can place the order (ORDER_EVALUATED?)
        const requestedOrder = { ...action.payload }
        const paidCommission = client.calculateCommission(requestedOrder)
        const builtOrder = buildLimitOrder(requestedOrder, paidCommission)
        store.dispatch({ type: ORDER_CREATED, payload: builtOrder })
        break
      }
      case ORDER_CREATED: {
        const executedOrder = await client.executeOrder({ ...action.payload })
        store.dispatch({ type: ORDER_PLACED, payload: { ...executedOrder } })
        break
      }
      default:
        break
      }
      return next(action)
    }
  }
}