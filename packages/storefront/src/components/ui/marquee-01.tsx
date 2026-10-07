import { BlurImage } from '@/components/blur-image';
import { Card, CardContent } from '@/components/ui/card';
import { Marquee } from '@/components/ui/marquee-01-utils/marquee';

const reviews = [
  {
    name: 'Arjun Mehta',
    username: '@arjunruns',
    body: '“Fit is spot on and they arrived in two days. Easily the comfiest pair I own — I wear them for both training and everyday.”',
    profile:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=faces',
  },
  {
    name: 'Sara Kapoor',
    username: '@sarak',
    body: '“The colourway is even better in person. Packaging felt premium and the sizing guide was accurate to the millimetre.”',
    profile:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces',
  },
  {
    name: 'David Fernandes',
    username: '@dfernandes',
    body: '“Ordered a limited drop and it shipped faster than expected. Quality of the build is genuinely excellent for the price.”',
    profile:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces',
  },
  {
    name: 'Priya Nair',
    username: '@priyanair',
    body: 'Support helped me swap a size with zero hassle. The return was picked up next morning — best sneaker buying experience so far.',
    profile:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=faces',
  },
  {
    name: 'Marcus Lee',
    username: '@marcuslee',
    body: '“Been wearing them daily for a month and the sole still looks new. Traction is fantastic and they run true to size.”',
    profile:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=64&h=64&fit=crop&crop=faces',
  },
  {
    name: 'Neha Sharma',
    username: '@nehas',
    body: '“Clean, minimal design that goes with everything. Got compliments the first day. Will absolutely order from here again.”',
    profile:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=64&h=64&fit=crop&crop=faces',
  },
  {
    name: 'Rohan Verma',
    username: '@rohanv',
    body: '“Authenticity was my worry buying online — completely put at ease. Everything checked out and they feel like the real deal.”',
    profile:
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=64&h=64&fit=crop&crop=faces',
  },
];

const firstRow = reviews.slice(0, Math.ceil(reviews.length / 2));
const secondRow = reviews.slice(Math.ceil(reviews.length / 2));

const ReviewCard = ({
  profile,
  name,
  username,
  body,
}: {
  profile: string;
  name: string;
  username: string;
  body: string;
}) => {
  return (
    <Card className="relative h-full w-64 cursor-pointer overflow-hidden border-line bg-paper p-4 shadow-none">
      <CardContent className="flex flex-col gap-2 p-0">
        <div className="flex flex-row items-center gap-2">
          <BlurImage
            src={profile}
            alt=""
            shimmer={false}
            wrapperClassName="h-8 w-8 shrink-0 rounded-full bg-line"
            className="h-full w-full rounded-full object-cover"
          />
          <div className="flex flex-col">
            <p className="text-sm font-medium text-ink">{name}</p>
            <p className="text-xs font-medium text-neutral-500">{username}</p>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-ink">{body}</p>
      </CardContent>
    </Card>
  );
};

export default function TestimonialMarqueeDemo() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
      <Marquee pauseOnHover className="[--duration:20s]">
        {firstRow.map((review) => (
          <ReviewCard key={review.username} {...review} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:20s]">
        {secondRow.map((review) => (
          <ReviewCard key={review.username} {...review} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-paper"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-paper"></div>
    </div>
  );
}
