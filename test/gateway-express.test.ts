
import GatewayExpress from '../src/gateway-express'

import Seneca from 'seneca'


describe('gateway-express', () => {

  test('happy', async () => {
    const seneca = Seneca({ legacy: false })
      .test()
      .use('promisify')
      .use('gateway')
      .use(GatewayExpress)
    await seneca.ready()
  })

  test('basic', async () => {
    const seneca = Seneca({ legacy: false })
      .test()

      // use quiet$ directive when available
      .quiet()

      .use('promisify')
      .use('gateway')
      .use(GatewayExpress)
      .act('sys:gateway,add:hook,hook:fixed', { action: { y: 99 } })
      .message('foo:1', async function(m: any) {
        return { x: m.x, y: m.y }
      })

    await seneca.ready()

    let handler = seneca.export('gateway-express/handler')

    let tmp: any = [{}]
    let reqmock = (body: any) => ({
      path: '/seneca',
      body
    })
    let resmock = {
      status: (code: any) => {
        tmp[0].code = code
        return this
      },
      send: (out: any) => tmp[0].out = out
    }
    let nextmock = () => tmp[0].next = true

    await handler(reqmock({ foo: 1, x: 2 }), resmock, nextmock)

    expect(tmp[0].out).toMatchObject({ x: 2, y: 99 })
  })



  test('express-error-basic', done => {
    Seneca({
      legacy: false
    })
      .test()
      .quiet()
      .use('promisify')
      .use('gateway')
      .use(GatewayExpress)

      .message('foo:1', async function(msg: any) {
        return msg
      })

      .ready(async function() {
        try {
          const seneca = this
          const handler = seneca.export('gateway-express/handler')

          const req = make_mock_request({ body: { bad: 2 } })
          const res = {
            status(_code: any) {
              throw new Error('response code should not be sent')
            },

            send(_out: any) {
              throw new Error('response data should not be sent')
            }
          }

          await handler(req, res, (err: any, _req: any, _res: any, _next: any) => {
            expect(err).toMatchObject({
              error$: true,
              seneca$: true,
              code$: 'act_not_found'
            })

            return done()
          })
        } catch (err) {
          return done(err)
        }
      })
  })


  test('express-error-bypass', done => {
    const responses = []

    Seneca({
      legacy: false
    })
      .test()
      .quiet()
      .use('promisify')
      .use('gateway')

      .use(GatewayExpress, {
        bypass_express_error_handler: true
      })

      .message('foo:1', async function(msg: any) {
        return msg
      })

      .ready(async function() {
        try {
          const seneca = this
          const handler = seneca.export('gateway-express/handler')

          const req = make_mock_request({ body: { bad: 2 } })

          const res = {
            status(_code: any) {
              return this
            },

            send(out: any) {
              responses.push(out)
            }
          }


          await handler(req, res, (_err: any, _req: any, _res: any, _next: any) => {
            return done(
              new Error("The Express error handler shouldn't have been called")
            )
          })

          expect(responses.length).toEqual(1)

          expect(responses[0]).toEqual({
            seneca$: true,
            code$: 'act_not_found',
            error$: true,
            meta$: undefined
          })

          return done()
        } catch (err) {
          return done(err)
        }
      })
  })
})



function make_mock_request(args: any) {
  const body = args.body

  return {
    path: '/whatever',
    body
  }
}
