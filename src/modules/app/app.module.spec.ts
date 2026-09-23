import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Compiles the real module graph.
 *
 * `compile()` resolves every provider and every controller-scoped enhancer without
 * running lifecycle hooks, so this needs no database and still catches what neither
 * `tsc` nor the guard specs can: a guard whose constructor argument is not
 * resolvable from the module that declares the controller using it. That shipped
 * once — a guard needing a provider that `BastionModule` did not export — as a
 * green build, green specs, and an UnknownDependenciesException on boot.
 */
describe('AppModule', () => {
  const ENV = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/articuno_test',
    BASTION_URL: 'http://bastion:8080',
  };

  let saved: Record<string, string | undefined>;

  beforeAll(() => {
    saved = Object.fromEntries(
      Object.keys(ENV).map((k) => [k, process.env[k]]),
    );
    Object.assign(process.env, ENV);
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('resolves every dependency in the real graph', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await module.close();
  });
});
