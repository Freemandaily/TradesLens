import assert from "assert";
import { TestHelpers, Pool, Swap } from "generated";
const { MockDb, UniswapV3Factory, UniswapV3Pool, Addresses } = TestHelpers;

describe("UniswapV3Factory", () => {
  it("PoolCreated creates a new Pool entity", async () => {
    const mockDbEmpty = MockDb.createMockDb();

    const mockPoolCreated = UniswapV3Factory.PoolCreated.createMockEvent({
      token0: Addresses.mockAddresses[0],
      token1: Addresses.mockAddresses[1],
      fee: 3000n,
      tickSpacing: 60n,
      pool: Addresses.mockAddresses[2],
    });

    const mockDbAfter = await UniswapV3Factory.PoolCreated.processEvent({
      event: mockPoolCreated,
      mockDb: mockDbEmpty,
    });

    const pool = mockDbAfter.entities.Pool.get(Addresses.mockAddresses[2]);

    assert.notEqual(pool, undefined, "Pool should exist");
    assert.equal(pool?.token0, Addresses.mockAddresses[0], "token0 should match");
    assert.equal(pool?.token1, Addresses.mockAddresses[1], "token1 should match");
    assert.equal(pool?.fee, 3000, "fee should match");
  });
});

describe("UniswapV3Pool", () => {
  it("Swap creates a new Swap entity", async () => {
    const mockDbEmpty = MockDb.createMockDb();

    const mockSwap = UniswapV3Pool.Swap.createMockEvent({
      sender: Addresses.mockAddresses[0],
      recipient: Addresses.mockAddresses[1],
      amount0: 1000n,
      amount1: -500n,
      sqrtPriceX96: 79228162514264337593543950336n,
      liquidity: 1000000n,
      tick: -100n,
    });

    const mockDbAfter = await UniswapV3Pool.Swap.processEvent({
      event: mockSwap,
      mockDb: mockDbEmpty,
    });

    // Verify a swap entity was created
    const swapId = `${mockSwap.block.hash}-${mockSwap.logIndex}`;
    const swap = mockDbAfter.entities.Swap.get(swapId);
    assert.notEqual(swap, undefined, "Swap should exist");
  });
});
