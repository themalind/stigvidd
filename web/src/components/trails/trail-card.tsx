import { Card, CardContent, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";

export default function TrailCard() {
  return (
    <Card className="w-full max-w-sm xl:max-w-7xl bg-background gap-0 overflow-hidden rounded-xs">
      <CardContent>
        <form className="flex gap-4">
          <div className="flex flex-col flex-1 gap-4 xl:max-w-sm">
            <CardTitle>Ledinformation</CardTitle>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Namn</Label>
                <Input id="name" type="text" placeholder="Lednamn" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="length">Längd</Label>
                <Input
                  id="length"
                  type="number"
                  placeholder="2,5 km"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="classification">Svårighetsgrad</Label>
                <Input
                  id="classification"
                  type="text"
                  placeholder="Lätt"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Kortfattad beskrivning</Label>
                <Textarea placeholder="Kort beskrivning" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description-full">Beskrivning</Label>
                <Textarea placeholder="Lång beskrivning" />
              </div>
            </div>
          </div>

          <div className="py-6">
            <Separator />
          </div>

          <div className="flex flex-col gap-4">
            <CardTitle>Tillgänglighetsanpassning</CardTitle>
            <div className="grid gap-2">
              <Label htmlFor="asd">Ja / Nej</Label>
              <Checkbox />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asd">Information</Label>
              <Input id="asdd" type="text" placeholder="Info-text" />
            </div>
          </div>

          <div className="py-6">
            <Separator />
          </div>

          <div className="flex flex-col gap-4">
            <CardTitle>Något</CardTitle>

            <div className="grid gap-2">
              <Label htmlFor="asdf">Asdf</Label>
              <Input id="asdf" type="text" placeholder="asdf" required />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/*

Classification

TrailSymbol
TrailSymbolImage
Description
Coordinates
Identifier
CreatedAt
LastsUpdatedAt
FillDescription
Tags
CreatedBy
IsVerified
City
*/
