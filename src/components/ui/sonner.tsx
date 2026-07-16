import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            'group toast bg-card! text-card-foreground! border-border! shadow-lg! rounded-md! text-sm!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
