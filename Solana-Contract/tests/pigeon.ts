import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pigeon } from "../target/types/pigeon";
import { assert } from "chai";
import { PublicKey, SystemProgram } from "@solana/web3.js";

describe("pigeon", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.pigeon as Program<Pigeon>;
  const admin = provider.wallet;

  // PDA for global state
  const [pigeonStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pigeon-state")],
    program.programId
  );

  // Test phone number
  const phone = "1234567890";
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), Buffer.from(phone)],
    program.programId
  );

  const testAddress = "So11111111111111111111111111111112";
  const testMnemonic = "dGVzdC1lbmNyeXB0ZWQtbW5lbW9uaWMtYmFzZTY0";
  const testCreatedAt = new anchor.BN(Math.floor(Date.now() / 1000));

  it("initializes the program state", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        pigeonState: pigeonStatePda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  Initialize tx:", tx);

    const state = await program.account.pigeonState.fetch(pigeonStatePda);
    assert.ok(state.admin.equals(admin.publicKey));
    assert.equal(state.totalUsers.toNumber(), 0);
  });

  it("onboards a user", async () => {
    const tx = await program.methods
      .onboardUser(phone, testAddress, testMnemonic, testCreatedAt)
      .accounts({
        pigeonState: pigeonStatePda,
        userAccount: userPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  Onboard tx:", tx);

    const user = await program.account.userAccount.fetch(userPda);
    assert.equal(user.phone, phone);
    assert.equal(user.address, testAddress);
    assert.equal(user.encryptedMnemonic, testMnemonic);
    assert.equal(user.createdAt.toNumber(), testCreatedAt.toNumber());

    const state = await program.account.pigeonState.fetch(pigeonStatePda);
    assert.equal(state.totalUsers.toNumber(), 1);
  });

  it("gets total users", async () => {
    const result = await program.methods
      .getTotalUsers()
      .accounts({
        pigeonState: pigeonStatePda,
      })
      .view();

    assert.equal(result.toNumber(), 1);
  });

  it("gets a user by phone", async () => {
    const result = await program.methods
      .getUser(phone)
      .accounts({
        userAccount: userPda,
      })
      .view();

    assert.equal(result.phone, phone);
    assert.equal(result.address, testAddress);
    assert.equal(result.encryptedMnemonic, testMnemonic);
  });

  it("checks user exists", async () => {
    const result = await program.methods
      .userExists(phone)
      .accounts({
        userAccount: userPda,
      })
      .view();

    assert.equal(result, true);
  });

  it("gets user address by phone", async () => {
    const result = await program.methods
      .getUserAddress(phone)
      .accounts({
        userAccount: userPda,
      })
      .view();

    assert.equal(result, testAddress);
  });

  it("updates a user", async () => {
    const newAddress = "So11111111111111111111111111111113";
    const newMnemonic = "bmV3LWVuY3J5cHRlZC1tbmVtb25pYw==";

    const tx = await program.methods
      .updateUser(phone, newAddress, newMnemonic)
      .accounts({
        pigeonState: pigeonStatePda,
        userAccount: userPda,
        admin: admin.publicKey,
      })
      .rpc();

    console.log("  Update tx:", tx);

    const user = await program.account.userAccount.fetch(userPda);
    assert.equal(user.address, newAddress);
    assert.equal(user.encryptedMnemonic, newMnemonic);
    // created_at should be preserved
    assert.equal(user.createdAt.toNumber(), testCreatedAt.toNumber());
  });

  it("rejects non-admin onboard_user", async () => {
    const fakeAdmin = anchor.web3.Keypair.generate();
    const fakePhone = "9999999999";
    const [fakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), Buffer.from(fakePhone)],
      program.programId
    );

    // Airdrop to fake admin so they can pay
    const sig = await provider.connection.requestAirdrop(
      fakeAdmin.publicKey,
      1_000_000_000
    );
    await provider.connection.confirmTransaction(sig);

    try {
      await program.methods
        .onboardUser(fakePhone, testAddress, testMnemonic, testCreatedAt)
        .accounts({
          pigeonState: pigeonStatePda,
          userAccount: fakePda,
          admin: fakeAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([fakeAdmin])
        .rpc();
      assert.fail("Should have thrown Unauthorized error");
    } catch (err) {
      assert.include(err.toString(), "Unauthorized");
    }
  });

  it("deletes a user", async () => {
    const tx = await program.methods
      .deleteUser(phone)
      .accounts({
        pigeonState: pigeonStatePda,
        userAccount: userPda,
        admin: admin.publicKey,
      })
      .rpc();

    console.log("  Delete tx:", tx);

    const state = await program.account.pigeonState.fetch(pigeonStatePda);
    assert.equal(state.totalUsers.toNumber(), 0);

    // Account should no longer exist
    const account = await provider.connection.getAccountInfo(userPda);
    assert.isNull(account);
  });
});
