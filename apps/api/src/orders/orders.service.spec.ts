import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const address = {
  name: 'Test Person',
  email: '',
  altMobileNo: '',
  mobileNo: '9876543210',
  line1: '12 Main Street',
  line2: '',
  landmark: '',
  pincode: '400001',
  city: 'Mumbai',
  state: 'Maharashtra',
};

function build(order: unknown) {
  const shipment = { pushForOrder: jest.fn().mockResolvedValue({}) };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...(order as object), ...data })),
    },
  };
  const audit = { log: jest.fn() };
  const service = new OrdersService(prisma as never, audit as never, shipment as never, {} as never);
  return { service, prisma, audit, shipment };
}

describe('OrdersService.addAddress', () => {
  it('rejects an unknown order', async () => {
    const { service } = build(null);
    await expect(service.addAddress('x', address)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects pickup orders', async () => {
    const { service, prisma } = build({ id: 'o1', isPickup: true, addressLine1: '' });
    await expect(service.addAddress('o1', address)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an existing address', async () => {
    const { service, prisma } = build({ id: 'o1', isPickup: false, addressLine1: 'Old St' });
    await expect(service.addAddress('o1', address)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('writes the address columns and audits it when the order has none', async () => {
    const { service, prisma, audit, shipment } = build({
      id: 'o1',
      orderNumber: '7',
      isPickup: false,
      addressLine1: '',
    });
    await service.addAddress('o1', address, 'admin@x.com').catch(() => undefined);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ addressLine1: '12 Main Street', pincode: '400001', city: 'Mumbai' }),
      }),
    );
    expect(audit.log).toHaveBeenCalled();
    expect(shipment.pushForOrder).toHaveBeenCalledWith('o1', 'admin@x.com');
  });
});
